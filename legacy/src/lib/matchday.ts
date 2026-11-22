/**
 * Feuille de match du jour : découpe la journée en créneaux de travail (pomodoros) autour des cours,
 * DS et khôlles, et place les tâches recommandées dedans. Sert au « coup d'envoi » anti-procrastination.
 */
import type { Evaluation, Lesson, Session, Task } from "./types";
import { spentMinutes } from "./insights";
import { startOfDay } from "./utils";

export type BlockKind = "busy" | "lunch" | "warmup" | "work";
export type Block = {
  id: string;
  start: Date;
  end: Date;
  kind: BlockKind;
  label: string;
  subject?: string;
  taskId?: string;
  /** Créneau passé : joué (assez de minutes de travail dedans) ou manqué */
  status?: "done" | "missed" | "now" | "next" | "later";
};

/** Heure d'arrivée par défaut (index 0 = dimanche). Lundi 10h30 : l'heure réelle, pas l'idéal. */
export const DEFAULT_DAY_STARTS = ["10:00", "10:30", "09:00", "09:00", "09:00", "09:00", "10:00"];
/** BU fermée à 21h (22h pour la BU de médecine) ; après, prolongations possibles à la maison. */
export const DEFAULT_DAY_END = "21:00";

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m || 0, 0, 0);
  return d;
};
const MIN = 60000;

export function buildMatchSheet(opts: {
  now?: Date;
  lessons: Lesson[];
  evals: Evaluation[];
  /** Tâches dans l'ordre de priorité (recommandations) */
  tasks: Task[];
  sessions: Session[];
  work: number;
  pause: number;
  dayStart?: string;
  dayEnd?: string;
  warmupDone: boolean;
  /** Objectif du jour (min) : on ne prévoit pas plus de travail que ça */
  goalMin?: number;
}) {
  const now = opts.now ?? new Date();
  const day = startOfDay(now);
  const dayStart = at(day, opts.dayStart ?? DEFAULT_DAY_STARTS[day.getDay()]);
  const dayEnd = at(day, opts.dayEnd ?? DEFAULT_DAY_END);
  const sameDay = (d: Date) => +startOfDay(d) === +day;

  // Créneaux occupés : cours, DS, khôlles, puis la pause déjeuner si elle est libre.
  const busy: Block[] = [
    ...opts.lessons
      .filter((l) => !l.canceled && sameDay(new Date(l.start)))
      .map((l) => ({ id: l.id, start: new Date(l.start), end: new Date(l.end), kind: "busy" as const, label: l.subject, subject: l.subject })),
    ...opts.evals
      .filter((e) => sameDay(new Date(e.date)))
      .map((e) => {
        const s = new Date(e.date);
        return { id: e.id, start: s, end: new Date(+s + (e.durationMin ?? 60) * MIN), kind: "busy" as const, label: `${e.type} ${e.subject}`, subject: e.subject };
      }),
  ];
  const lunch = { id: "lunch", start: at(day, "12:00"), end: at(day, "13:00"), kind: "lunch" as const, label: "Déjeuner" };
  if (!busy.some((b) => b.start < lunch.end && b.end > lunch.start)) busy.push(lunch);
  busy.sort((a, b) => +a.start - +b.start);

  // Fenêtres libres entre dayStart et dayEnd
  const free: Array<[Date, Date]> = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) free.push([cursor, b.start < dayEnd ? b.start : dayEnd]);
    if (b.end > cursor) cursor = b.end;
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) free.push([cursor, dayEnd]);

  // Tâches à placer, avec ce qu'il leur reste
  const queue = opts.tasks.filter((t) => !t.done).map((t) => ({ t, left: Math.max(opts.work, t.estimateMin - spentMinutes(t, opts.sessions)) }));
  const blocks: Block[] = [];
  let warmupPlaced = false;
  let planned = 0;
  const goal = opts.goalMin ?? Infinity;
  for (const [a, b] of free) {
    let s = a;
    while (+b - +s >= 15 * MIN && planned < goal) {
      if (!warmupPlaced) {
        warmupPlaced = true;
        const e = new Date(+s + 15 * MIN);
        blocks.push({ id: `w-${+s}`, start: s, end: e, kind: "warmup", label: "Échauffement : cartes + QCM d'anglais" });
        s = new Date(+e + opts.pause * MIN);
        continue;
      }
      const e = new Date(Math.min(+s + opts.work * MIN, +b));
      const len = (+e - +s) / MIN;
      planned += len;
      const q = queue.find((x) => x.left > 0);
      if (q) q.left -= len;
      blocks.push(
        q
          ? { id: `b-${+s}`, start: s, end: e, kind: "work", label: q.t.title, subject: q.t.subject, taskId: q.t.id }
          : { id: `b-${+s}`, start: s, end: e, kind: "work", label: "Révisions libres (cartes, annale EDHEC)" },
      );
      s = new Date(+e + opts.pause * MIN);
    }
  }

  // Statut de chaque créneau de travail : minutes réellement travaillées dedans
  const worked = (a: Date, b: Date) =>
    opts.sessions.reduce((acc, x) => {
      const s = new Date(x.start);
      const e = new Date(+s + x.minutes * MIN);
      return acc + Math.max(0, (Math.min(+e, +b) - Math.max(+s, +a)) / MIN);
    }, 0);
  let current: Block | undefined;
  for (const bl of blocks) {
    const len = (+bl.end - +bl.start) / MIN;
    if (bl.kind === "warmup" && opts.warmupDone) bl.status = "done";
    else if (worked(bl.start, bl.end) >= len * 0.5) bl.status = "done";
    else if (bl.end <= now) bl.status = "missed";
    else if (!current) {
      current = bl;
      bl.status = bl.start <= now ? "now" : "next";
    } else bl.status = "later";
  }

  const plannedMin = blocks.filter((b) => b.kind !== "warmup").reduce((a, b) => a + (+b.end - +b.start) / MIN, 0);
  const playedMin = Math.round(worked(dayStart, dayEnd));
  const lateMin = current && current.start < now ? Math.round((+now - +current.start) / MIN) : 0;
  const missed = blocks.filter((b) => b.status === "missed").length;
  const timeline = [...busy.filter((b) => b.end > dayStart && b.start < dayEnd), ...blocks].sort((a, b) => +a.start - +b.start);
  return { blocks, timeline, current, plannedMin, playedMin, lateMin, missed, dayStart, dayEnd };
}
