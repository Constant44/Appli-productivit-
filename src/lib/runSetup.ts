/**
 * Mise en place de la course à pied dans le planning : 3 sorties par semaine, jamais deux jours de suite
 * (lundi et jeudi avec Basic-Fit, samedi dehors). Sans dépendance à l'exécution (imports de types seulement).
 */
import type { Activity, Category, Goal } from "./model";

export const RUN_CATEGORY: Category = { id: "course", name: "Course à pied", color: "#00F0C8", tracked: true };
export const RUN_GOAL: Goal = { id: "g-course", label: "Course (programme)", cat: "course", unit: "séances", target: 3, period: "semaine" };

const FROM = "2026-11-23";
const UNTIL = "2027-04-03";
const TITLE = "Course : séance du programme";
const GYM = "Sur le tapis de course de Basic-Fit (vitesse où tu peux parler, 1 % de pente) ou dehors juste avant. ▶ lance la séance guidée.";

const serie = (id: string, day: number, start: string, end: string, notes: string): Activity => ({
  id, title: TITLE, cat: "course", prio: "important", date: FROM, start, end, check: true, notes, source: "seed",
  repeat: { days: [day], every: 1, until: UNTIL },
});

export const runSeries = (): Activity[] => [
  serie("run-lu", 0, "16:15", "16:55", GYM),
  serie("run-je", 3, "15:30", "16:10", GYM),
  serie("run-sa", 5, "17:25", "18:05", "Dehors, au calme : rues éclairées ou quais, vêtement clair. ▶ lance la séance guidée."),
];

/** Basic-Fit devient « renfo après la course » (seulement si tu n'as pas modifié ces séances). */
const GYM_SHIFT: Array<{ title: string; start: string; patch: Partial<Activity> }> = [
  { title: "Sport : Basic-Fit (vélo compris)", start: "16:15", patch: { title: "Sport : Basic-Fit renfo (après la course)", start: "16:55", end: "17:30", notes: "Juste après ta séance de course. 35 min de renfo." } },
  { title: "Sport : Basic-Fit", start: "15:30", patch: { title: "Sport : Basic-Fit renfo (après la course)", start: "16:10", end: "16:50", notes: "Juste après ta séance de course. 40 min de renfo." } },
];

export function adaptGym(a: Activity): Activity {
  if (a.edited || a.cat !== "sport") return a;
  const m = GYM_SHIFT.find((g) => g.title === a.title && g.start === a.start);
  return m ? { ...a, ...m.patch } : a;
}
