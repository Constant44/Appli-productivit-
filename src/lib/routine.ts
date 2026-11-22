/**
 * Routines du matin et du soir.
 *
 * Chaque étape est placée par rapport à une ancre du jour :
 * - le matin, ton LEVER = début de la « Routine du matin » prévue ce jour-là (7 h 15, 8 h ou 10 h selon le jour) ;
 * - le soir, ton EXTINCTION = fin de la lecture du soir (23 h 15), sinon l'heure de coucher des réglages.
 * Le soir n'est cadré que si le lendemain commence tôt (lever avant 9 h). Vendredi et samedi soir : libre.
 *
 * Après l'étape « Écrans coupés », plus rien ne se coche à l'écran : l'heure d'extinction et la lecture
 * se notent le lendemain matin, dans la routine du matin.
 */
import { addDays, fromMin, toMin, type ISODate } from "./dates";
import { expand, type Plan } from "./model";
import { DEFAULT_ROUTINES, type RoutineKind, type RoutineStep } from "./routineDefaults";

export { DEFAULT_ROUTINES };
export type { RoutineAction, RoutineKind, RoutineLog, RoutineStep, Routines } from "./routineDefaults";

const isMorningRoutine = (title: string) => /^routine du matin/i.test(title);

/** Heure de lever prévue le jour `d`. */
export function wakeAt(plan: Plan, d: ISODate): string {
  const o = expand(plan, d, d).find((x) => x.start && x.cat === "vie" && isMorningRoutine(x.title));
  return o?.start ?? plan.prefs.wakeTarget;
}

/** La séance de lecture du soir `night`, s'il y en a une. */
export const lectureOcc = (plan: Plan, night: ISODate) => expand(plan, night, night).find((x) => x.cat === "lecture" && x.end);

/** Heure d'extinction prévue le soir `night`. */
export const lightsOut = (plan: Plan, night: ISODate): string => lectureOcc(plan, night)?.end ?? plan.prefs.bedTarget;

/** Soir cadré : le lendemain commence tôt (lever avant 9 h). */
export const eveningExpected = (plan: Plan, night: ISODate) => toMin(wakeAt(plan, addDays(night, 1))) <= 9 * 60;

/** Heure d'une étape (anchor ± minutes), sur 24 h. */
export const stepClock = (anchor: string, at: number) => fromMin((((toMin(anchor) + at) % 1440) + 1440) % 1440);

export const stepsOf = (plan: Plan, kind: RoutineKind) => [...plan.routines[kind]].sort((a, b) => a.at - b.at);
export const checked = (plan: Plan, date: ISODate, kind: RoutineKind) => plan.routineLog[date]?.[kind] ?? [];
export const isDone = (plan: Plan, date: ISODate, kind: RoutineKind, id: string) => checked(plan, date, kind).includes(id);

/** Index de l'étape « Écrans coupés » (les suivantes se font sans écran). */
export const screensIndex = (steps: RoutineStep[]) => steps.findIndex((s) => s.action === "screens");

/* ------------------------------------------------------------------ sommeil */

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Date de la « nuit » : un coucher entre minuit et 6 h compte pour la veille. */
export const nightOf = (at: Date) => {
  const d = new Date(at);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return isoDay(d);
};

/** Enregistrer un lever ou un coucher maintenant. */
export function logSleep(plan: Plan, kind: "bed" | "wake", at = new Date()): Plan {
  const day = kind === "bed" ? nightOf(at) : isoDay(at);
  return { ...plan, sleep: { ...plan.sleep, [day]: { ...(plan.sleep[day] ?? {}), [kind]: at.toISOString() } } };
}

/** Noter après coup l'heure d'extinction du soir `night` (« 00:30 » = après minuit, le lendemain). */
export function setBedAt(plan: Plan, night: ISODate, hhmm: string): Plan {
  const day = toMin(hhmm) < 12 * 60 ? addDays(night, 1) : night;
  const iso = new Date(`${day}T${hhmm}:00`).toISOString();
  return { ...plan, sleep: { ...plan.sleep, [night]: { ...(plan.sleep[night] ?? {}), bed: iso } } };
}

const withoutField = (plan: Plan, day: ISODate, field: "bed" | "wake"): Plan => {
  const n = { ...(plan.sleep[day] ?? {}) };
  delete n[field];
  return { ...plan, sleep: { ...plan.sleep, [day]: n } };
};

/* ------------------------------------------------------------------ cocher une étape */

function setChecked(plan: Plan, date: ISODate, kind: RoutineKind, id: string, on: boolean): Plan {
  const day = plan.routineLog[date] ?? {};
  const list = day[kind] ?? [];
  const next = on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);
  return { ...plan, routineLog: { ...plan.routineLog, [date]: { ...day, [kind]: next } } };
}

/** Marquer la lecture du soir `night` comme faite (ou l'annuler). */
function setLecture(plan: Plan, night: ISODate, on: boolean, at = new Date()): Plan {
  const o = lectureOcc(plan, night);
  if (!o) return plan;
  const done = { ...plan.done };
  if (on) done[o.key] = done[o.key] ?? { at: at.toISOString(), minutes: o.minutes };
  else delete done[o.key];
  return { ...plan, done };
}

/**
 * Cocher / décocher une étape. Les étapes liées font aussi leur effet :
 * lever → heure de lever notée ; lecture → la lecture du soir est validée ; extinction → heure de coucher notée.
 * `date` : le jour (matin) ou le soir concerné.
 */
export function toggleStep(plan: Plan, date: ISODate, kind: RoutineKind, id: string, at = new Date()): Plan {
  const step = plan.routines[kind].find((s) => s.id === id);
  const on = !isDone(plan, date, kind, id);
  let next = setChecked(plan, date, kind, id, on);
  if (step?.action === "wake") next = on ? (next.sleep[date]?.wake ? next : logSleep(next, "wake", at)) : withoutField(next, date, "wake");
  if (step?.action === "lecture") next = setLecture(next, date, on, at);
  if (step?.action === "bed") next = on ? logSleep(next, "bed", at) : withoutField(next, date, "bed");
  return next;
}

/** Le matin : noter l'heure d'extinction de la veille (et cocher l'étape correspondante). */
export function reportBed(plan: Plan, night: ISODate, hhmm: string): Plan {
  const bed = plan.routines.soir.find((s) => s.action === "bed");
  const next = setBedAt(plan, night, hhmm);
  return bed ? setChecked(next, night, "soir", bed.id, true) : next;
}

/** Le matin : « j'ai lu hier soir » oui / non (coche l'étape et valide la lecture). */
export function reportLecture(plan: Plan, night: ISODate, on: boolean): Plan {
  const read = plan.routines.soir.find((s) => s.action === "lecture");
  let next = setLecture(plan, night, on);
  if (read) next = setChecked(next, night, "soir", read.id, on);
  return { ...next, routineLog: { ...next.routineLog, [night]: { ...(next.routineLog[night] ?? {}), lu: on } } };
}

/** Ce qu'il reste à noter, le matin, sur la soirée d'hier. */
export function nightPending(plan: Plan, night: ISODate) {
  if (!eveningExpected(plan, night)) return { bed: false, lecture: false };
  const lec = lectureOcc(plan, night);
  const answered = plan.routineLog[night]?.lu !== undefined || (lec ? !!lec.done : true);
  return { bed: !plan.sleep[night]?.bed, lecture: !answered };
}

/** Progression d'une routine : étapes cochées / total. */
export function progressOf(plan: Plan, date: ISODate, kind: RoutineKind) {
  const steps = plan.routines[kind];
  const c = checked(plan, date, kind);
  return { done: steps.filter((s) => c.includes(s.id)).length, total: steps.length };
}
