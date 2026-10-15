import type { Evaluation, Grade, Plan, Session, Task } from "./types";
import { addDays, daysUntil, isoDay, startOfDay } from "./utils";

// ================= Temps réel & calibration =================

export function actualMinutes(task: Task, sessions: Session[]): number | null {
  if (task.actualMinManual != null) return task.actualMinManual;
  const s = sessions.filter((x) => x.taskId === task.id).reduce((a, b) => a + b.minutes, 0);
  return s > 0 ? s : null;
}

export function spentMinutes(task: Task, sessions: Session[]) {
  return sessions.filter((x) => x.taskId === task.id).reduce((a, b) => a + b.minutes, 0);
}

export type Calibration = {
  /** facteur multiplicatif : temps réel ≈ facteur × estimation */
  factor: number;
  samples: number;
  /** part des tâches estimées à ±20 % */
  accuracy: number;
};

/**
 * Le facteur est la moyenne géométrique des ratios réel/estimé.
 * (La moyenne géométrique est la bonne moyenne pour des ratios : une tâche 2× trop longue
 * et une 2× trop courte se compensent exactement, ce qui n'est pas le cas en moyenne arithmétique.)
 */
function calibrate(pairs: Array<[number, number]>): Calibration {
  if (!pairs.length) return { factor: 1, samples: 0, accuracy: NaN };
  const logs = pairs.map(([est, act]) => Math.log(act / est));
  const factor = Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length);
  const accuracy = pairs.filter(([e, a]) => Math.abs(a / e - 1) <= 0.2).length / pairs.length;
  return { factor, samples: pairs.length, accuracy };
}

export function calibrationData(tasks: Task[], sessions: Session[]) {
  const bySubject = new Map<string, Array<[number, number]>>();
  const all: Array<[number, number]> = [];
  const points: Array<{ task: Task; est: number; act: number }> = [];
  for (const t of tasks) {
    if (!t.done || t.estimateMin <= 0) continue;
    const act = actualMinutes(t, sessions);
    if (!act) continue;
    all.push([t.estimateMin, act]);
    points.push({ task: t, est: t.estimateMin, act });
    const k = t.subject || "Autre";
    if (!bySubject.has(k)) bySubject.set(k, []);
    bySubject.get(k)!.push([t.estimateMin, act]);
  }
  const subjects = new Map<string, Calibration>();
  for (const [k, v] of bySubject) subjects.set(k, calibrate(v));
  return { global: calibrate(all), subjects, points };
}

/** Estimation corrigée : facteur de la matière si ≥ 3 points, sinon facteur global si ≥ 3, sinon brute. */
export function correctedEstimate(
  estimate: number,
  subject: string,
  cal: ReturnType<typeof calibrationData>,
) {
  const s = cal.subjects.get(subject);
  if (s && s.samples >= 3) return { value: estimate * s.factor, factor: s.factor, basis: subject };
  if (cal.global.samples >= 3) return { value: estimate * cal.global.factor, factor: cal.global.factor, basis: "global" };
  return { value: estimate, factor: 1, basis: null as string | null };
}

// ================= Séries =================

export const STREAK_MIN = 25;

export function minutesByDay(sessions: Session[]) {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(isoDay(s.start), (m.get(isoDay(s.start)) ?? 0) + s.minutes);
  return m;
}

/** Jours consécutifs avec ≥ 25 min de travail. La série reste vivante si aujourd'hui n'est pas encore validé. */
export function currentStreak(sessions: Session[], now = new Date()) {
  const m = minutesByDay(sessions);
  let d = startOfDay(now);
  if ((m.get(isoDay(d)) ?? 0) < STREAK_MIN) d = addDays(d, -1);
  let n = 0;
  while ((m.get(isoDay(d)) ?? 0) >= STREAK_MIN) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ================= Moyennes =================

export function subjectAverages(grades: Grade[]) {
  const map = new Map<string, { sum: number; w: number; n: number }>();
  for (const g of grades) {
    if (!g.outOf) continue;
    const v = (g.value / g.outOf) * 20;
    const k = map.get(g.subject) ?? { sum: 0, w: 0, n: 0 };
    k.sum += v * g.coefficient;
    k.w += g.coefficient;
    k.n++;
    map.set(g.subject, k);
  }
  const out = [...map.entries()]
    .filter(([, v]) => v.w > 0)
    .map(([subject, v]) => ({ subject, avg: v.sum / v.w, n: v.n }));
  const overall = out.length ? out.reduce((a, b) => a + b.avg, 0) / out.length : NaN;
  return { bySubject: out.sort((a, b) => a.subject.localeCompare(b.subject)), overall };
}

// ================= Recommandations =================

export type Reco = { task: Task; score: number; reasons: string[] };

export function recommend(tasks: Task[], evals: Evaluation[], grades: Grade[], now = new Date()): Reco[] {
  const { bySubject, overall } = subjectAverages(grades);
  const avgOf = (s: string) => bySubject.find((x) => x.subject.toLowerCase() === s.toLowerCase())?.avg;
  const upcoming = evals.filter((e) => new Date(e.date) >= startOfDay(now));

  return tasks
    .filter((t) => !t.done)
    .map((t) => {
      const reasons: string[] = [];
      let score = 0;
      const linked = t.evalId ? evals.find((e) => e.id === t.evalId) : undefined;
      const deadline = t.due ?? (linked ? isoDay(linked.date) : undefined);
      if (deadline) {
        const d = daysUntil(deadline, now);
        if (d < 0) {
          score += 14;
          reasons.push(`en retard de ${-d} j`);
        } else {
          score += 10 / (d + 1);
          if (d <= 1) reasons.push(d === 0 ? "à rendre aujourd'hui" : "pour demain");
          else if (d <= 4) reasons.push(`échéance dans ${d} j`);
        }
      }
      const sameSubjectEval = upcoming
        .filter((e) => e.subject.toLowerCase() === t.subject.toLowerCase())
        .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
      const ev = linked ?? sameSubjectEval;
      if (ev) {
        const d = daysUntil(ev.date, now);
        if (d >= 0 && d <= 10) {
          const w = ev.type === "DS" || ev.type === "Concours blanc" ? 8 : 6;
          score += w / (d + 1);
          reasons.push(`${ev.type} de ${ev.subject} ${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} j`}`);
        }
      }
      if (t.priority > 1) {
        score += (t.priority - 1) * 1.5;
        if (t.priority === 3) reasons.push("priorité haute");
      }
      const a = avgOf(t.subject);
      if (a !== undefined && !Number.isNaN(overall) && a < overall - 0.5) {
        score += Math.min(3, (overall - a) * 0.6);
        reasons.push(`matière faible (${a.toFixed(1)} vs ${overall.toFixed(1)} de moy.)`);
      }
      if (!reasons.length) reasons.push("pas d'urgence : bon moment pour avancer");
      return { task: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** Évaluations à venir (≤ 10 j) sans aucune tâche de préparation liée. */
export function unpreparedEvals(evals: Evaluation[], tasks: Task[], now = new Date()) {
  return evals.filter((e) => {
    const d = daysUntil(e.date, now);
    return d >= 0 && d <= 10 && !tasks.some((t) => t.evalId === e.id);
  });
}

// ================= Planificateur de révisions =================

export type PlannedItem = { taskId: string; minutes: number; late: boolean };
export type PlannedDay = { date: string; capacity: number; items: PlannedItem[]; load: number };

/**
 * Répartit glouton les tâches du plan sur les jours disponibles.
 * Ordre : échéance la plus proche, puis priorité. Les tâches sont découpées en blocs ≥ 20 min.
 * Le reste à faire utilise l'estimation corrigée moins le temps déjà passé.
 */
export function buildSchedule(
  plan: Plan,
  tasks: Task[],
  sessions: Session[],
  cal: ReturnType<typeof calibrationData>,
  now = new Date(),
) {
  const first = startOfDay(new Date(Math.max(+startOfDay(plan.start), +startOfDay(now))));
  const last = startOfDay(plan.end);
  const days: PlannedDay[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const cap = plan.daysOff.includes(d.getDay()) ? 0 : plan.dailyMin;
    days.push({ date: isoDay(d), capacity: cap, items: [], load: 0 });
  }
  const todo = tasks
    .filter((t) => t.planId === plan.id && !t.done)
    .map((t) => {
      const corr = correctedEstimate(t.estimateMin, t.subject, cal).value;
      const remaining = Math.max(10, Math.round(corr - spentMinutes(t, sessions)));
      return { t, remaining };
    })
    .sort(
      (a, b) =>
        (a.t.due ? +new Date(a.t.due) : Infinity) - (b.t.due ? +new Date(b.t.due) : Infinity) ||
        b.t.priority - a.t.priority,
    );

  const unscheduled: Array<{ task: Task; minutes: number }> = [];
  for (const { t, remaining } of todo) {
    let left = remaining;
    for (const day of days) {
      if (left <= 0) break;
      const free = day.capacity - day.load;
      if (free < 20 && free < left) continue;
      const chunk = Math.min(left, free);
      if (chunk <= 0) continue;
      const late = !!t.due && day.date > t.due;
      const existing = day.items.find((i) => i.taskId === t.id);
      if (existing) existing.minutes += chunk;
      else day.items.push({ taskId: t.id, minutes: chunk, late });
      day.load += chunk;
      left -= chunk;
    }
    if (left > 0) unscheduled.push({ task: t, minutes: left });
  }
  const needed = todo.reduce((a, b) => a + b.remaining, 0);
  const capacity = days.reduce((a, b) => a + b.capacity, 0);
  return { days, unscheduled, needed, capacity };
}
