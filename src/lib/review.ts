/**
 * Bilan de la semaine, calculé UNIQUEMENT à partir des séances validées.
 * Une séance programmée mais non cochée n'est jamais comptée comme faite.
 */
import { addDays, fmtDur, type ISODate } from "./dates";
import { expand, goalTarget, goalValue, type Occ, type Plan } from "./model";

export type ReviewLine = {
  cat: string;
  name: string;
  color: string;
  plannedMin: number;
  doneMin: number;
  pct: number;
  plannedCount: number;
  doneCount: number;
  missed: Array<{ key: string; title: string; date: ISODate; minutes: number }>;
};

export type WeekReview = {
  week: ISODate;
  lines: ReviewLine[];
  totals: { plannedMin: number; doneMin: number; rate: number; tasksDone: number; tasksLeft: number; tasksUpcoming: number; postponed: number };
  goals: Array<{ id: string; label: string; unit: string; value: number; target: number }>;
  insights: string[];
  /** date à laquelle le bilan d'une semaine terminée a été figé */
  frozenAt?: string;
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function computeReview(plan: Plan, week: ISODate, today: ISODate, previous?: WeekReview): WeekReview {
  const end = addDays(week, 6);
  const ended = today > end;
  const occs = expand(plan, week, end).filter((o) => o.check);
  const cats = new Map(plan.categories.map((c) => [c.id, c]));
  const by = new Map<string, Occ[]>();
  for (const o of occs) {
    if (!cats.get(o.cat)?.tracked) continue;
    by.set(o.cat, [...(by.get(o.cat) ?? []), o]);
  }
  const lines: ReviewLine[] = [...by.entries()]
    .map(([cat, list]) => {
      const c = cats.get(cat)!;
      const plannedMin = list.reduce((s, o) => s + o.minutes, 0);
      const doneMin = list.reduce((s, o) => s + (o.done?.minutes ?? 0), 0);
      return {
        cat, name: c.name, color: c.color, plannedMin, doneMin, pct: pct(doneMin, plannedMin),
        plannedCount: list.length, doneCount: list.filter((o) => o.done).length,
        missed: list.filter((o) => !o.done && (ended || o.date < today)).map((o) => ({ key: o.key, title: o.title, date: o.date, minutes: o.minutes })),
      };
    })
    .sort((a, b) => b.plannedMin - a.plannedMin);

  const plannedMin = lines.reduce((s, l) => s + l.plannedMin, 0);
  const doneMin = lines.reduce((s, l) => s + l.doneMin, 0);
  const tasksDone = occs.filter((o) => o.done).length;
  const tasksLeft = occs.filter((o) => !o.done && (ended || o.date < today)).length;
  const tasksUpcoming = occs.filter((o) => !o.done && !ended && o.date >= today).length;
  const postponed = plan.postponed.filter((p) => p.from >= week && p.from <= end).length;

  const goals = plan.goals
    .filter((g) => g.period === "semaine")
    .map((g) => ({ id: g.id, label: g.label, unit: g.unit, value: Math.round(goalValue(plan, g, week, end) * 10) / 10, target: goalTarget(g, 7) }));

  const review: WeekReview = {
    week, lines, goals,
    totals: { plannedMin, doneMin, rate: pct(doneMin, plannedMin), tasksDone, tasksLeft, tasksUpcoming, postponed },
    insights: [],
  };
  review.insights = insights(review, ended, previous);
  return review;
}

/** Résumé en phrases, fondé uniquement sur les chiffres du bilan (rien d'inventé). */
export function insights(r: WeekReview, ended: boolean, previous?: WeekReview): string[] {
  const out: string[] = [];
  const t = r.totals;
  if (!t.plannedMin) return ["Aucune séance prévue cette semaine dans les catégories suivies."];
  out.push(`Tu as validé ${fmtDur(t.doneMin)} sur ${fmtDur(t.plannedMin)} prévues (${t.rate} %).`);
  for (const l of r.lines) {
    if (l.pct >= 100) out.push(`Tu as atteint 100 % de ton temps prévu en ${l.name}.`);
    else if (l.doneMin === 0 && (ended || l.missed.length)) out.push(`Aucune séance de ${l.name} validée${ended ? " cette semaine" : " pour l'instant"} (${fmtDur(l.plannedMin)} prévues).`);
    else if (l.pct < 50 && ended) out.push(`Tu as réalisé seulement ${l.pct} % de ton temps prévu en ${l.name}.`);
  }
  for (const g of r.goals) {
    if (g.target > 0 && g.value >= g.target) out.push(`Objectif « ${g.label} » atteint : ${fmtGoal(g.value, g.unit)} sur ${fmtGoal(g.target, g.unit)}.`);
  }
  if (t.postponed) out.push(`${t.postponed} séance${t.postponed > 1 ? "s" : ""} reportée${t.postponed > 1 ? "s" : ""} à un autre jour.`);
  if (previous && previous.totals.plannedMin) {
    const diff = t.rate - previous.totals.rate;
    if (diff !== 0) out.push(`Taux de réalisation ${diff > 0 ? "en hausse" : "en baisse"} de ${Math.abs(diff)} points par rapport à la semaine précédente (${previous.totals.rate} %).`);
  }
  return out;
}

export const fmtGoal = (v: number, unit: string) =>
  unit === "h" ? fmtDur(v * 60) : unit === "€" ? `${Math.round(v)} €` : `${Math.round(v)} séance${Math.round(v) >= 2 ? "s" : ""}`;
