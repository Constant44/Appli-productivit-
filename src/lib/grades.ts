/**
 * Notes (Pronote, importées chaque soir) et copies corrigées (DS, synthèses EDHEC, khôlles) avec l'analyse des erreurs.
 * Les notes viennent de Pronote ; les copies, de toi (dans l'appli) ou de Claude quand tu lui envoies une correction.
 */
import { addDays, type ISODate } from "./dates";

export type Grade = {
  id: string; subject: string; value: number; outOf: number; coefficient: number; date: string;
  label?: string; classAverage?: number; period?: string; source?: string;
};

export type CopyError = { type: string; note?: string };
export type Copy = {
  id: string;
  date: ISODate;
  /** catégorie (micro, anglais, synthese…) */
  cat: string;
  kind: "DS" | "Synthèse" | "Khôlle" | "Devoir" | "Concours blanc";
  title: string;
  grade?: number;
  outOf?: number;
  errors: CopyError[];
  /** ce que je retiens / ce que je change la prochaine fois */
  lessons?: string;
  source?: "app" | "claude";
};

/** Types d'erreurs proposés, par matière (on peut en saisir d'autres). */
export const ERROR_TYPES: Record<string, string[]> = {
  micro: ["Cours / définition pas su", "Méthode / démarche", "Erreur de calcul", "Conditions (CPO, CSO) oubliées", "Graphique faux ou absent", "Interprétation économique", "Rédaction / justification", "Manque de temps"],
  anglais: ["Grammaire (temps, accords)", "Vocabulaire", "Contresens / faux-sens", "Calque / anglicisme", "Orthographe", "Structure de l'essai", "Idées / arguments", "Manque de temps"],
  synthese: ["Contresens sur un texte", "Confrontation insuffisante", "Problématique / plan", "Texte oublié ou déséquilibré", "Introduction", "Reformulation (paraphrase, citations)", "Nombre de mots", "Expression / orthographe", "Manque de temps"],
  default: ["Cours pas su", "Méthode", "Erreur de calcul", "Rédaction", "Manque de temps"],
};
export const errorTypesFor = (cat: string) => ERROR_TYPES[cat] ?? ERROR_TYPES.default;

/** La synthèse EDHEC n'est pas notée : PGE-PGO renvoie une correction, on n'analyse que les erreurs. */
export const isUngraded = (c: Pick<Copy, "cat" | "kind">) => c.cat === "synthese" || c.kind === "Synthèse";
export const UNGRADED_LABEL = "Correction PGE-PGO · non notée";

/** Matière Pronote → catégorie de l'appli. */
export function subjectCat(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("math")) return "maths";
  if (s.includes("micro")) return "micro";
  if (s.includes("macro") || s.includes("monétaire")) return "macro";
  if (s.includes("gestion")) return "gestion";
  if (s.includes("anglais")) return "anglais";
  if (s.includes("espagnol") || s.includes("lv2")) return "espagnol";
  if (s.includes("actu")) return "actu";
  if (s.includes("synth")) return "synthese";
  return "autre";
}

export const on20 = (g: Pick<Grade, "value" | "outOf">) => (g.value / g.outOf) * 20;
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export type SubjectSummary = {
  subject: string;
  cat: string;
  count: number;
  /** moyenne /20 pondérée par les coefficients */
  avg: number;
  last: Grade;
  /** écart de la dernière note (/20) avec la précédente */
  delta?: number;
  /** écart de la moyenne avec la dernière note comprise vs sans elle */
  avgDelta?: number;
  /** écart de la dernière note avec la moyenne de la classe (/20) */
  vsClass?: number;
  trend: number[];
};

export function summarize(grades: Grade[]): SubjectSummary[] {
  const by = new Map<string, Grade[]>();
  for (const g of grades) by.set(g.subject, [...(by.get(g.subject) ?? []), g]);
  const wavg = (l: Grade[]) => {
    const w = l.reduce((s, g) => s + (g.coefficient || 1), 0);
    return w ? l.reduce((s, g) => s + on20(g) * (g.coefficient || 1), 0) / w : 0;
  };
  return [...by.entries()]
    .map(([subject, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const avg = wavg(sorted);
      return {
        subject, cat: subjectCat(subject), count: sorted.length, avg: round(avg), last,
        delta: prev ? round(on20(last) - on20(prev)) : undefined,
        avgDelta: prev ? round(avg - wavg(sorted.slice(0, -1))) : undefined,
        vsClass: last.classAverage !== undefined ? round(on20(last) - (last.classAverage / last.outOf) * 20) : undefined,
        trend: sorted.map((g) => round(on20(g))),
      };
    })
    .sort((a, b) => b.last.date.localeCompare(a.last.date));
}

/** Notes reçues pendant la semaine (date de l'évaluation dans la semaine). */
export const gradesOfWeek = (grades: Grade[], week: ISODate) =>
  grades.filter((g) => g.date.slice(0, 10) >= addDays(week, -1) && g.date.slice(0, 10) <= addDays(week, 6));

/** Erreurs récurrentes d'une matière : nombre de copies où chaque type apparaît, sur les `last` dernières copies. */
export function recurringErrors(copies: Copy[], cat: string, last = 6) {
  const list = copies.filter((c) => c.cat === cat).sort((a, b) => b.date.localeCompare(a.date)).slice(0, last);
  const counts = new Map<string, number>();
  for (const c of list) for (const t of new Set(c.errors.map((e) => e.type))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return { copies: list.length, ranked: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, n })) };
}

/** Phrases factuelles sur les notes et les copies (aucune invention). */
export function gradeInsights(sums: SubjectSummary[], copies: Copy[], catName: (id: string) => string): string[] {
  const out: string[] = [];
  for (const s of sums) {
    if (s.delta === undefined) continue;
    if (s.delta >= 1.5) out.push(`${s.subject} : en progrès, ${fmt20(on20(s.last))} contre ${fmt20(on20(s.last) - s.delta)} la fois d'avant (+${fmtNum(s.delta)}).`);
    else if (s.delta <= -1.5) out.push(`${s.subject} : en baisse, ${fmt20(on20(s.last))} contre ${fmt20(on20(s.last) - s.delta)} la fois d'avant (${fmtNum(s.delta)}).`);
  }
  for (const cat of ["micro", "anglais", "synthese"]) {
    const r = recurringErrors(copies, cat);
    const top = r.ranked[0];
    if (top && top.n >= 2) out.push(`${catName(cat)} : « ${top.type} » revient dans ${top.n} copies sur ${r.copies}. C'est le point n°1 à travailler.`);
  }
  return out;
}

export const fmtNum = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1)).replace(".", ",");
export const fmt20 = (x: number) => `${fmtNum(round(x))}/20`;
