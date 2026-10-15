/**
 * Répétition espacée (variante simplifiée de SM-2).
 *
 * Chaque carte a un intervalle I (jours) et un facteur de facilité E.
 * Après une bonne réponse, I est multiplié par E (≈ 2,5 au départ) : 1 j → 3 j → 7 j → 18 j…
 * Après un échec, la carte revient dans 10 min et son facteur baisse.
 * Plafonds : une carte d'actu revient au plus tard la veille du test ; les mots et personnages
 * reviennent au moins toutes les 3 semaines (tout peut tomber, le test est cumulatif).
 */
import type { Card } from "./types";
import { addDays, startOfDay } from "./utils";

export type Review = { due: string; interval: number; ease: number; reps: number; lapses: number; last: string };
/** 0 = raté, 1 = difficile, 2 = bien, 3 = facile */
export type Rating = 0 | 1 | 2 | 3;

export const MAX_INTERVAL_DAYS = 21;

/** Prochain vendredi strictement après `now` si on est vendredi après midi, sinon le vendredi de la semaine. */
export function nextTestDay(now = new Date()) {
  const d = startOfDay(now);
  const wd = d.getDay();
  let delta = (5 - wd + 7) % 7;
  if (delta === 0 && now.getHours() >= 12) delta = 7;
  return addDays(d, delta);
}

/** Début de la « semaine d'actu » couverte par le prochain test : le vendredi précédent. */
export const actuWeekStart = (now = new Date()) => addDays(nextTestDay(now), -7);

export function schedule(prev: Review | undefined, rating: Rating, card: Pick<Card, "deck">, now = new Date()): Review {
  const ease0 = prev?.ease ?? 2.5;
  const reps0 = prev?.reps ?? 0;
  if (rating === 0) {
    return {
      due: new Date(now.getTime() + 10 * 60000).toISOString(),
      interval: 0, ease: Math.max(1.3, ease0 - 0.2), reps: 0, lapses: (prev?.lapses ?? 0) + 1, last: now.toISOString(),
    };
  }
  const reps = reps0 + 1;
  let interval: number;
  if (reps === 1) interval = rating === 3 ? 3 : 1;
  else if (reps === 2) interval = rating === 1 ? 2 : rating === 2 ? 3 : 6;
  else interval = Math.round((prev?.interval || 1) * ease0 * (rating === 1 ? 0.6 : rating === 3 ? 1.3 : 1));
  const ease = Math.max(1.3, ease0 + (rating === 1 ? -0.15 : rating === 3 ? 0.1 : 0));
  interval = Math.max(1, Math.min(MAX_INTERVAL_DAYS, interval));
  let due = addDays(startOfDay(now), interval);
  if (card.deck === "actu") {
    // revoir au plus tard la veille du test
    const eve = addDays(nextTestDay(now), -1);
    if (due > eve && eve > startOfDay(now)) due = eve;
  }
  due.setHours(4, 0, 0, 0);
  return { due: due.toISOString(), interval, ease, reps, lapses: prev?.lapses ?? 0, last: now.toISOString() };
}

export const isDue = (r: Review | undefined, now = new Date()) => !!r && new Date(r.due) <= now;

/**
 * Construit une séance : d'abord les cartes en retard (les plus anciennes d'abord), puis des nouvelles cartes
 * dans la limite `newLimit`. Les cartes d'actu de la semaine du test passent devant.
 */
export function buildQueue(cards: Card[], reviews: Record<string, Review>, opts: { newLimit: number; max: number; decks?: string[] }, now = new Date()) {
  const pool = cards.filter((c) => !opts.decks || opts.decks.includes(c.deck));
  const weekStart = actuWeekStart(now);
  const inWeek = (c: Card) => c.deck !== "actu" || (c.date ? new Date(c.date) >= addDays(weekStart, -1) : true);
  const due = pool
    .filter((c) => isDue(reviews[c.id], now) && inWeek(c))
    .sort((a, b) => +new Date(reviews[a.id].due) - +new Date(reviews[b.id].due));
  const fresh = pool
    .filter((c) => !reviews[c.id] && inWeek(c))
    .sort((a, b) => Number(b.deck === "actu") - Number(a.deck === "actu") || (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, opts.newLimit);
  return interleave([...due, ...fresh]).slice(0, opts.max);
}

/** Évite d'enchaîner 10 cartes du même personnage : alterne les références. */
function interleave(cards: Card[]) {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const k = c.ref ?? c.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }
  const out: Card[] = [];
  const lists = [...groups.values()];
  for (let i = 0; out.length < cards.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export function shuffle<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
