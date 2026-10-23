/**
 * Programme quotidien : répartit le travail des prochaines semaines jour par jour.
 * - Chaque DS / khôlle / épreuve écrite à venir demande un volume de préparation, étalé sur les jours qui précèdent.
 * - S'y ajoutent l'EDHEC (chapitres de micro, synthèse, traduction), la veille du test d'actu et la lecture de l'actu.
 * - La capacité de chaque jour dépend des cours (jours de classe, vacances, voyages).
 * Le programme est recalculé chaque jour : ce qui n'a pas été fait est replanifié, ce qui est fait est déduit.
 */
import type { EdhecState, Evaluation, Task } from "./types";
import { inHolidays } from "./srs";
import { addDays, isoDay, startOfDay } from "./utils";

export const PROGRAM_DAYS = 21;

/** Minutes de programme par jour (hors échauffement), index 0 = dimanche. Jours de cours : le soir surtout. */
const SCHOOL_CAPACITY = [180, 210, 120, 150, 150, 90, 240];
const HOLIDAY_CAPACITY = 240;

export type ProgramInput = {
  today: Date;
  evals: Evaluation[];
  tasks: Task[];
  edhec: EdhecState;
  dailyGoalMin: number;
  /** Capacité imposée certains jours (voyage, événement) : date ISO → minutes */
  capacity?: Record<string, number>;
};

type Need = { key: string; title: string; subject: string; minutes: number; from: string; to: string; evalId?: string; due?: string; block: number; priority: 1 | 2 | 3; kind: Task["kind"]; /** peut déborder la capacité du jour (préparation d'épreuve) */ must?: boolean };

/** Volume de préparation selon l'épreuve (minutes) et étalement (jours avant). */
function prepFor(e: Evaluation): { minutes: number; spread: number } {
  const dur = e.durationMin ?? 60;
  if (e.type === "DS" || e.type === "Concours blanc") {
    if (/entretien|épistémo|conférence/i.test(`${e.subject} ${e.topic ?? ""}`)) return { minutes: 120, spread: 6 };
    return dur >= 180 ? { minutes: 420, spread: 8 } : dur >= 120 ? { minutes: 240, spread: 6 } : { minutes: 120, spread: 4 };
  }
  if (e.type === "Khôlle") return { minutes: e.subject === "Entretien" ? 90 : 120, spread: 4 };
  return { minutes: 60, spread: 3 };
}

const fmtD = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

export function buildProgram(inp: ProgramInput): Task[] {
  const today = startOfDay(inp.today);
  const t0 = isoDay(today);
  const days = Array.from({ length: PROGRAM_DAYS }, (_, i) => isoDay(addDays(today, i)));
  const last = days[days.length - 1];
  const cap = new Map<string, number>();
  for (const d of days) {
    const wd = new Date(`${d}T12:00:00`).getDay();
    const base = inp.capacity?.[d] ?? (inHolidays(d) ? HOLIDAY_CAPACITY : SCHOOL_CAPACITY[wd]);
    cap.set(d, Math.min(base, inp.dailyGoalMin));
  }
  // Ce qui est déjà fait (tâches du programme cochées) est déduit des besoins
  const doneMin = new Map<string, number>();
  for (const t of inp.tasks) if (t.program && t.done) doneMin.set(t.program, (doneMin.get(t.program) ?? 0) + t.estimateMin);

  const needs: Need[] = [];
  // 1. DS, khôlles, épreuves des 4 prochaines semaines
  for (const e of inp.evals) {
    const ed = isoDay(e.date);
    if (ed <= t0 || ed > isoDay(addDays(today, PROGRAM_DAYS + 7))) continue;
    const { minutes, spread } = prepFor(e);
    const key = `ev-${e.id}`;
    const left = minutes - (doneMin.get(key) ?? 0);
    if (left <= 0) continue;
    const what = e.topic ? ` : ${e.topic}` : e.hint ? ` · piste : ${e.hint} (à confirmer)` : " (programme à préciser)";
    needs.push({
      key, evalId: e.id, due: ed, subject: e.subject, minutes: left, block: e.type === "DS" ? 60 : 45,
      from: isoDay(addDays(new Date(`${ed}T12:00:00`), -spread)), to: isoDay(addDays(new Date(`${ed}T12:00:00`), -1)),
      title: `Préparer ${e.type === "Khôlle" ? "la khôlle" : e.type === "DS" ? "le DS" : "l'épreuve"} de ${e.subject} (${fmtD(ed)})${what}`,
      priority: e.type === "DS" ? 3 : 2, kind: "revision", must: true,
    });
  }
  // 2. Veille du test d'actu (jeudi) + lecture quotidienne de l'actu, hors vacances
  for (const d of days) {
    const wd = new Date(`${d}T12:00:00`).getDay();
    if (wd === 4 && !inHolidays(d)) needs.push({ key: `actu-veille-${d}`, title: "Spécial veille de test : actu de la semaine + bios + mots", subject: "Approf. méthodo", minutes: 30, block: 30, from: d, to: d, priority: 3, kind: "revision" });
    if (wd !== 5 && wd !== 6) needs.push({ key: `actu-${d}`, title: "Lire l'actu du jour (doc Actu) et noter 3 faits marquants", subject: "Approf. méthodo", minutes: 20, block: 20, from: d, to: d, priority: 1, kind: "fiche" });
  }
  // 3. EDHEC : un chapitre de micro par semaine (2 × 60 min), une synthèse toutes les deux semaines (le jour le plus libre), traduction 2 × 30 min / semaine
  const chapters = inp.edhec.chapters.filter((c) => c.level < 3);
  for (let w = 0; w * 7 < PROGRAM_DAYS; w++) {
    const ws = isoDay(addDays(today, w * 7)), we = isoDay(addDays(today, Math.min(w * 7 + 6, PROGRAM_DAYS - 1)));
    const ch = chapters[w];
    if (ch) {
      const key = `edhec-${ch.id}`;
      const left = 120 - (doneMin.get(key) ?? 0);
      if (left > 0) needs.push({ key, title: `EDHEC micro · ${ch.name} : cours + exercices (Hachon & Laurent)`, subject: "Microéconomie", minutes: left, block: 60, from: ws, to: we, priority: 2, kind: "exercices" });
    }
    if (w % 2 === 0) {
      needs.push({ key: `edhec-syn-${ws}`, title: "EDHEC synthèse : une synthèse chronométrée (3h) dans l'entraîneur", subject: "EDHEC Synthèse", minutes: 180, block: 180, from: ws, to: we, priority: 2, kind: "exercices" });
    }
    needs.push({ key: `edhec-trad-${ws}`, title: "EDHEC anglais : 15 phrases de traduction + correction", subject: "EDHEC Anglais", minutes: 60, block: 30, from: ws, to: we, priority: 1, kind: "exercices" });
  }

  // Répartition : échéance la plus proche d'abord, un bloc par besoin et par jour, jour le moins chargé d'abord
  needs.sort((a, b) => a.to.localeCompare(b.to) || b.priority - a.priority);
  const out: Task[] = [];
  const used = new Map<string, number>(days.map((d) => [d, 0]));
  for (const n of needs) {
    const from = n.from < t0 ? t0 : n.from;
    const to = n.to > last ? last : n.to;
    if (from > last) continue;
    if (to < from) {
      // échéance demain ou aujourd'hui : on garde le peu qu'on peut aujourd'hui
      if (n.to >= t0) placeBlock(n, t0, Math.min(n.minutes, 60), 0);
      continue;
    }
    const window = days.filter((d) => d >= from && d <= to);
    let left = n.minutes;
    let i = 0;
    for (let pass = 0; left > 0 && pass < 4; pass++) {
      const order = [...window].sort((a, b) => (cap.get(b)! - used.get(b)!) - (cap.get(a)! - used.get(a)!) || a.localeCompare(b));
      for (const d of order) {
        if (left <= 0) break;
        const free = cap.get(d)! - used.get(d)!;
        if (free < Math.min(n.block, left) && (pass < 3 || !n.must)) continue;
        const m = Math.min(n.block, left);
        placeBlock(n, d, m, i++);
        left -= m;
      }
    }
  }
  return out.sort((a, b) => (a.plannedFor ?? "").localeCompare(b.plannedFor ?? "") || b.priority - a.priority);

  function placeBlock(n: Need, d: string, m: number, i: number) {
    used.set(d, (used.get(d) ?? 0) + m);
    out.push({
      id: `prog-${n.key}-${d}-${i}`, title: n.title, subject: n.subject, kind: n.kind, due: n.due ?? n.to, estimateMin: m,
      priority: n.priority, done: false, createdAt: `${t0}T00:00:00.000Z`, source: "manual", evalId: n.evalId,
      plannedFor: d, program: n.key,
    });
  }
}

/** Remplace les tâches du programme non faites par un programme recalculé (null si rien ne change). */
export function mergeProgram(tasks: Task[], fresh: Task[]): Task[] | null {
  const old = tasks.filter((t) => t.program && !t.done);
  const sig = (l: Task[]) => l.map((t) => `${t.id.replace(/-b$/, "")}|${t.estimateMin}|${t.title}`).sort().join("\n");
  if (sig(old) === sig(fresh)) return null;
  const keep = tasks.filter((t) => !t.program || t.done);
  const ids = new Set(keep.map((t) => t.id));
  return [...keep, ...fresh.map((t) => (ids.has(t.id) ? { ...t, id: `${t.id}-b` } : t))];
}

/** Jours à capacité réduite connus (voyages). */
export const KNOWN_CAPACITY: Record<string, number> = {
  "2026-10-24": 60, "2026-10-25": 180, "2026-10-26": 180, "2026-10-27": 180, "2026-10-28": 180, "2026-10-29": 180, "2026-10-30": 180, "2026-10-31": 60,
  "2026-11-08": 30,
};
