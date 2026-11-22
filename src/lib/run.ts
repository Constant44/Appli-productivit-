/**
 * Apprendre à courir : de 0 à 30 minutes sans t'arrêter, en 11 semaines, 3 séances par semaine.
 *
 * Principe : alterner course très lente et marche, et allonger la course petit à petit. Le programme
 * s'adapte : une séance « trop dure » ou pas finie se refait (ce n'est pas un échec, c'est la méthode) ;
 * après une longue pause, on reprend une semaine en arrière.
 */
import { addDays, daysBetween, mondayOf, type ISODate } from "./dates";
import { expand, markDone, type Plan } from "./model";

export type RunBlockKind = "warm" | "run" | "walk" | "cool";
export type RunBlock = { kind: RunBlockKind; sec: number };
export type RunSession = { n: number; week: number; label: string; blocks: RunBlock[] };
/** Ressenti : 1 facile, 2 ça allait, 3 dur mais fait, 4 trop dur / pas fini */
export type Feel = 1 | 2 | 3 | 4;
export type RunLog = { id: string; date: ISODate; at: string; session: number; completed: boolean; feel: Feel; runSec: number; totalSec: number };
export type RunState = { log: RunLog[]; /** séance choisie à la main pour la prochaine sortie */ pick?: number };

export const FEELS: Record<Feel, string> = { 1: "Facile", 2: "Ça allait", 3: "Dur mais fait", 4: "Trop dur / pas fini" };
const WARM = 300;
const COOL = 300;

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
};

function intervals(reps: number, run: number, walk: number): Omit<RunSession, "n" | "week"> {
  const blocks: RunBlock[] = [{ kind: "warm", sec: WARM }];
  for (let i = 0; i < reps; i++) {
    blocks.push({ kind: "run", sec: run });
    if (i < reps - 1) blocks.push({ kind: "walk", sec: walk });
  }
  blocks.push({ kind: "cool", sec: COOL });
  return { label: `${reps} × (${mmss(run)} de course + ${mmss(walk)} de marche)`, blocks };
}
function continuous(run: number): Omit<RunSession, "n" | "week"> {
  return { label: `${mmss(run)} de course sans t'arrêter`, blocks: [{ kind: "warm", sec: WARM }, { kind: "run", sec: run }, { kind: "cool", sec: COOL }] };
}

const WEEKS: Array<Array<Omit<RunSession, "n" | "week">>> = [
  [intervals(8, 60, 90), intervals(8, 60, 90), intervals(8, 60, 90)],
  [intervals(7, 90, 90), intervals(7, 90, 90), intervals(7, 90, 90)],
  [intervals(6, 120, 90), intervals(6, 120, 90), intervals(6, 120, 90)],
  [intervals(5, 180, 90), intervals(5, 180, 90), intervals(5, 180, 90)],
  [intervals(4, 240, 90), intervals(4, 240, 90), intervals(4, 240, 90)],
  [intervals(3, 360, 120), intervals(3, 360, 120), intervals(3, 360, 120)],
  [intervals(3, 420, 90), intervals(3, 420, 90), intervals(3, 420, 90)],
  [intervals(2, 720, 120), intervals(2, 720, 120), intervals(2, 720, 120)],
  [intervals(2, 900, 120), intervals(2, 900, 120), intervals(2, 900, 120)],
  [continuous(1200), continuous(1320), continuous(1500)],
  [continuous(1500), continuous(1680), continuous(1800)],
];

export const PROGRAM: RunSession[] = WEEKS.flatMap((w, i) => w.map((s, j) => ({ ...s, week: i + 1, n: i * 3 + j + 1 })));
export const LAST = PROGRAM.length;
export const sessionOf = (n: number) => PROGRAM[Math.max(1, Math.min(LAST, n)) - 1];

/** Le conseil de la semaine : pour progresser ET aimer ça. */
export const WEEK_TIPS: string[] = [
  "Cours lentement. Vraiment lentement : tu dois pouvoir parler en phrases. Trottiner moins vite que tu ne marches vite, c'est permis et c'est même le bon rythme.",
  "L'essoufflement des premières semaines baisse vite : ton cœur et tes poumons s'adaptent plus vite que tu ne crois. Respire comme tu veux, nez et bouche.",
  "Garde une playlist ou un podcast que tu n'écoutes que quand tu cours. Ton cerveau va relier la course à ce plaisir.",
  "3 minutes d'affilée : premier vrai cap. Regarde loin devant, épaules basses, petits pas rapides plutôt que grandes foulées.",
  "Courbatures : normal. Une douleur vive, ou qui augmente en courant : tu marches, tu notes « Trop dur », tu refais la séance la fois d'après.",
  "6 minutes sans t'arrêter : change de parcours cette semaine. La nouveauté rend la sortie plus courte dans la tête.",
  "Quand ça devient dur, c'est souvent la tête qui lâche avant les jambes : compte 20 foulées, puis encore 20.",
  "12 minutes d'affilée. Il y a 7 semaines, tu courais 1 minute. Regarde ta courbe plus bas.",
  "15 minutes : tu es un coureur. Pas rapide, et la vitesse n'est pas le sujet. La régularité, si.",
  "20 minutes sans t'arrêter : le grand saut. Pars encore plus lentement que d'habitude, accélère zéro fois.",
  "30 minutes : l'objectif. Ensuite tu gardes 3 footings de 30 min par semaine, ou tu vises 5 km.",
];
export const tipOf = (n: number) => WEEK_TIPS[sessionOf(n).week - 1];

/** Les règles, toujours valables. */
export const RULES: string[] = [
  "Jamais deux jours de suite : le souffle progresse vite, les tendons et les os plus lentement. Le jour de repos, c'est là qu'ils se renforcent.",
  "Le test de la parole : si tu ne peux pas dire une phrase en courant, ralentis.",
  "Une séance trop dure ? Tu la refais. Le programme est fait pour être réussi, pas pour te mettre en échec.",
  "Des chaussures de running (pas des baskets de ville) : c'est le seul achat qui compte.",
  "Le soir dans le noir : vêtement clair ou bande réfléchissante, rues éclairées ou quais.",
  "Sur le tapis de Basic-Fit : règle la vitesse pour pouvoir parler, et mets 1 % de pente.",
];

export const blocksTotal = (s: RunSession) => s.blocks.reduce((a, b) => a + b.sec, 0);
export const runTotal = (s: RunSession) => s.blocks.filter((b) => b.kind === "run").reduce((a, b) => a + b.sec, 0);
export const longestRun = (s: RunSession) => Math.max(...s.blocks.filter((b) => b.kind === "run").map((b) => b.sec));

/** Paliers affichés sur le parcours. */
export const MILESTONES: Array<{ n: number; label: string }> = [
  { n: 1, label: "1re séance" },
  { n: 10, label: "3 min d'affilée" },
  { n: 16, label: "6 min d'affilée" },
  { n: 22, label: "12 min d'affilée" },
  { n: 28, label: "20 min sans t'arrêter" },
  { n: 33, label: "30 min : objectif" },
];

const sorted = (log: RunLog[]) => [...log].sort((a, b) => a.at.localeCompare(b.at));
/** Séance la plus avancée réussie. */
export const bestDone = (log: RunLog[]) => log.filter((l) => l.completed && l.feel < 4).reduce((m, l) => Math.max(m, l.session), 0);

/** La prochaine séance, et pourquoi. */
export function nextSession(run: RunState, today: ISODate): { n: number; reason?: string } {
  if (run.pick) return { n: sessionOf(run.pick).n, reason: "Séance choisie à la main." };
  const log = sorted(run.log);
  const last = log[log.length - 1];
  if (!last) return { n: 1 };
  let n = last.completed && last.feel < 4 ? last.session + 1 : last.session;
  let reason = n === last.session ? `On refait la séance ${n} : la dernière fois, c'était trop dur ou pas fini. C'est comme ça qu'on progresse.` : undefined;
  const gap = daysBetween(last.date, today);
  if (gap > 14 && n > 1) {
    n = Math.max(1, n - 3);
    reason = `${gap} jours sans courir : on reprend une semaine en arrière, ça reviendra vite.`;
  }
  if (n > LAST) return { n: LAST, reason: "Programme terminé : tu entretiens avec des footings de 30 min." };
  return { n, reason };
}

/** Statistiques pour l'onglet Course. */
export function runStats(run: RunState, today: ISODate) {
  const log = run.log;
  const done = log.filter((l) => l.completed);
  const longest = done.reduce((m, l) => Math.max(m, longestRun(sessionOf(l.session))), 0);
  const week0 = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(week0, -7 * (7 - i));
    const to = addDays(from, 6);
    const inW = log.filter((l) => l.date >= from && l.date <= to);
    return { from, runSec: inW.reduce((a, l) => a + l.runSec, 0), count: inW.length };
  });
  return {
    sessions: log.length,
    completed: done.length,
    runSec: log.reduce((a, l) => a + l.runSec, 0),
    longest,
    thisWeek: weeks[7].count,
    weeks,
  };
}

/** Enregistrer une sortie : journal + validation de la séance prévue dans le planning (si elle existe). */
export function recordRun(plan: Plan, entry: Omit<RunLog, "id">, occKey?: string): Plan {
  const id = `${entry.date}-${entry.at.slice(11, 19)}`;
  let next: Plan = { ...plan, run: { log: [...plan.run.log, { ...entry, id }] } };
  const key = occKey ?? expand(plan, entry.date, entry.date).find((o) => o.cat === "course" && !o.done)?.key;
  if (key) next = markDone(next, key, Math.max(1, Math.round(entry.totalSec / 60)));
  return next;
}

export const deleteRun = (plan: Plan, id: string): Plan => ({ ...plan, run: { ...plan.run, log: plan.run.log.filter((l) => l.id !== id) } });
export const pickSession = (plan: Plan, n?: number): Plan => ({ ...plan, run: { ...plan.run, pick: n } });

/* ------------------------------------------------------------------ séance en cours (minuteur) */

/** Où en est la séance après `elapsed` secondes. */
export function positionAt(s: RunSession, elapsed: number) {
  let t = 0;
  for (let i = 0; i < s.blocks.length; i++) {
    const b = s.blocks[i];
    if (elapsed < t + b.sec) return { i, block: b, inBlock: elapsed - t, left: t + b.sec - elapsed, start: t, done: false };
    t += b.sec;
  }
  const i = s.blocks.length - 1;
  return { i, block: s.blocks[i], inBlock: s.blocks[i].sec, left: 0, start: t - s.blocks[i].sec, done: true };
}

/** Secondes réellement courues après `elapsed` secondes de séance. */
export function runSecAt(s: RunSession, elapsed: number) {
  let t = 0;
  let r = 0;
  for (const b of s.blocks) {
    if (b.kind === "run") r += Math.max(0, Math.min(b.sec, elapsed - t));
    t += b.sec;
  }
  return Math.round(r);
}

/** Une séance est « finie » quand tous les blocs de course sont passés. */
export const completedAt = (s: RunSession, elapsed: number) => runSecAt(s, elapsed) >= runTotal(s) - 1;

/** Numéro de la répétition de course en cours (« course 3/8 »). */
export function repOf(s: RunSession, i: number) {
  const runs = s.blocks.map((b, k) => (b.kind === "run" ? k : -1)).filter((k) => k >= 0);
  const k = runs.findIndex((x) => x >= i);
  return { rep: k < 0 ? runs.length : k + 1, reps: runs.length };
}
