/**
 * Coach : tout est calculé à partir de tes données réelles (validations, échéances, sommeil). Rien d'inventé.
 */
import { addDays, daysBetween, fmtDur, fromMin, nowMin, toMin, type ISODate } from "./dates";
import { expand, type Occ, type Plan } from "./model";
import { lightsOut, wakeAt } from "./routine";
import { nextSession, sessionOf } from "./run";
import { sunTimes } from "./sun";

export { logSleep, nightOf } from "./routine";

/** Catégorie concernée par une échéance, d'après son titre. */
export function deadlineCat(title: string): string | undefined {
  const t = title.toLowerCase();
  if (/math/.test(t)) return "maths";
  if (/micro/.test(t)) return "micro";
  if (/gestion/.test(t)) return "gestion";
  if (/anglais/.test(t)) return "anglais";
  if (/espagnol/.test(t)) return "espagnol";
  if (/synth/.test(t)) return "synthese";
  if (/macro|monétaire|monetaire|éco/.test(t)) return "macro";
  return undefined;
}

/** Échéances à venir (14 j) avec leur matière. */
export function upcomingDeadlines(plan: Plan, today: ISODate, days = 14) {
  return expand(plan, today, addDays(today, days))
    .filter((o) => o.deadline)
    .map((o) => ({ occ: o, cat: deadlineCat(o.title), inDays: daysBetween(today, o.date) }));
}

/** Les 3 essentiels du jour : séances importantes non faites, la matière de l'échéance la plus proche d'abord. */
export function essentials(plan: Plan, date: ISODate, today: ISODate): Occ[] {
  const urgent = new Map<string, number>();
  for (const d of upcomingDeadlines(plan, today)) if (d.cat && !urgent.has(d.cat)) urgent.set(d.cat, d.inDays);
  return expand(plan, date, date)
    .filter((o) => o.check && !o.done && o.prio === "important" && !["lecture", "vie"].includes(o.cat))
    .map((o) => ({ o, w: (urgent.has(o.cat) ? 100 - urgent.get(o.cat)! * 5 : 0) + (o.cat === "anki" ? 5 : 0) }))
    .sort((a, b) => b.w - a.w || (a.o.start ?? "99").localeCompare(b.o.start ?? "99"))
    .slice(0, 3)
    .map((x) => x.o);
}

/** Un jour « tenu » : au moins 60 % des séances importantes validées. Les jours sans séance importante ne cassent pas la série. */
export function dayHeld(plan: Plan, d: ISODate): boolean | null {
  const imp = expand(plan, d, d).filter((o) => o.check && o.prio === "important" && o.cat !== "vie");
  if (!imp.length) return null;
  return imp.filter((o) => o.done).length / imp.length >= 0.6;
}

export function streak(plan: Plan, today: ISODate): number {
  let n = dayHeld(plan, today) ? 1 : 0;
  for (let d = addDays(today, -1), guard = 0; guard < 400; d = addDays(d, -1), guard++) {
    const h = dayHeld(plan, d);
    if (h === null) continue;
    if (!h) break;
    n++;
  }
  return n;
}

/** Ligne du coach pour la journée : l'échéance qui compte + ce qui s'est passé hier. */
export function coachLine(plan: Plan, today: ISODate): string[] {
  const out: string[] = [];
  const dl = upcomingDeadlines(plan, today, 12).filter((d) => d.occ.date >= today);
  const first = dl[0];
  if (first) {
    const when = first.inDays === 0 ? "aujourd'hui" : first.inDays === 1 ? "demain" : `dans ${first.inDays} j`;
    const cat = first.cat ? plan.categories.find((c) => c.id === first.cat)?.name : undefined;
    out.push(`${first.occ.title} ${when}${cat ? ` : ${cat.toLowerCase() === "maths" ? "les maths passent" : `${cat} passe`} en premier.` : "."}`);
  }
  // l'hiver, il fait nuit au réveil : la lumière du jour se prend dehors, le matin
  const sun = sunTimes(today);
  const nowM = nowMin();
  if (toMin(wakeAt(plan, today)) < toMin(sun.rise) && nowM < 11 * 60) {
    out.push(`Soleil levé à ${sun.rise} : 10 à 15 min dehors avant 11 h (trajet à pied, pause). C'est cette lumière-là qui recale ton sommeil.`);
  }
  const run = expand(plan, today, today).find((o) => o.cat === "course" && !o.done);
  if (run) {
    const n = nextSession(plan.run, today).n;
    out.push(`Course ${run.start ? `à ${run.start}` : "aujourd'hui"} : séance ${n}, ${sessionOf(n).label}.`);
  }
  const y = addDays(today, -1);
  const yOcc = expand(plan, y, y).filter((o) => o.check);
  if (yOcc.length) {
    const done = yOcc.filter((o) => o.done).reduce((s, o) => s + o.done!.minutes, 0);
    const planned = yOcc.reduce((s, o) => s + o.minutes, 0);
    out.push(done ? `Hier : ${fmtDur(done)} validées sur ${fmtDur(planned)} prévues.` : `Hier : aucune séance validée. Aujourd'hui, on repart : une séance à la fois.`);
  }
  return out;
}

/* ------------------------------------------------------------------ sommeil */

const hm = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
/** minutes après 18 h (pour moyenner des couchers qui passent minuit) */
const bedMin = (iso: string) => (hm(iso) + 24 * 60 - 18 * 60) % (24 * 60);

export type SleepStats = { nights: number; avgBed?: string; avgWake?: string; avgSleep?: number; onTimeBed: number; onTimeWake: number; logged: number };

export function sleepStats(plan: Plan, from: ISODate, to: ISODate): SleepStats {
  const beds: number[] = [];
  const wakes: number[] = [];
  const durs: number[] = [];
  let onTimeBed = 0;
  let onTimeWake = 0;
  // objectifs du jour : extinction = fin de la lecture du soir, lever = début de la routine du matin
  const bedT = (d: ISODate) => bedMin(`2000-01-01T${lightsOut(plan, d)}:00`);
  const wakeT = (d: ISODate) => toMin(wakeAt(plan, d));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const n = plan.sleep[d];
    const next = plan.sleep[addDays(d, 1)];
    if (n?.bed) {
      beds.push(bedMin(n.bed));
      if (bedMin(n.bed) <= bedT(d) + 15) onTimeBed++;
    }
    const w = plan.sleep[d]?.wake;
    if (w) {
      wakes.push(hm(w));
      if (hm(w) <= wakeT(d) + 15) onTimeWake++;
    }
    if (n?.bed && next?.wake) {
      const m = (new Date(next.wake).getTime() - new Date(n.bed).getTime()) / 60000;
      if (m > 120 && m < 16 * 60) durs.push(m);
    }
  }
  const avg = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : undefined);
  const ab = avg(beds);
  const aw = avg(wakes);
  return {
    nights: durs.length,
    avgBed: ab === undefined ? undefined : fromMin((ab + 18 * 60) % (24 * 60)),
    avgWake: aw === undefined ? undefined : fromMin(aw),
    avgSleep: avg(durs),
    onTimeBed, onTimeWake, logged: beds.length + wakes.length,
  };
}
