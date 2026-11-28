/** Test du vendredi 8 h : actu de la semaine (vendredi → jeudi), puis 2 mots OU 1 personnage en alternance. */
import { addDays, inHolidays, iso, weekday, type ISODate } from "./dates";
import type { QCard, QuizStats } from "./store";

/** Prochain test (vendredi). Après le test (vendredi midi), on passe au suivant. Pas de test pendant les vacances. */
export function nextTestDay(now = new Date()): ISODate {
  const d = iso(now);
  let delta = (4 - weekday(d) + 7) % 7;
  if (delta === 0 && now.getHours() >= 12) delta = 7;
  let t = addDays(d, delta);
  while (inHolidays(t)) t = addDays(t, 7);
  return t;
}

/** L'actu à connaître : du vendredi précédent au jeudi soir. */
export function inActuWeek(c: Pick<QCard, "deck" | "date">, now = new Date()) {
  if (c.deck !== "actu" || !c.date) return c.deck === "actu" ? false : true;
  const test = nextTestDay(now);
  return c.date >= addDays(test, -7) && c.date < test;
}

/** Alternance mots / personnage. Repère : le test du 13/11/2026 portait sur les mots. */
export function testFocus(now = new Date()): "mot" | "bio" {
  const anchor = "2026-11-13";
  const target = nextTestDay(now);
  let n = 0;
  if (target >= anchor) {
    for (let d = anchor; d < target; d = addDays(d, 7)) if (!inHolidays(addDays(d, 7))) n++;
  } else {
    for (let d = anchor; d > target; d = addDays(d, -7)) if (!inHolidays(d)) n++;
  }
  return n % 2 === 0 ? "mot" : "bio";
}

/** Tirage : cartes jamais vues et souvent ratées d'abord, puis le reste, mélangé. */
export function drawQuiz(cards: QCard[], stats: QuizStats, max = 15): QCard[] {
  const score = (c: QCard) => {
    const s = stats[c.id];
    if (!s) return -1;
    return s.ok - 2 * s.ko;
  };
  return [...cards]
    .map((c) => ({ c, r: score(c) + Math.random() * 1.5 }))
    .sort((a, b) => a.r - b.r)
    .slice(0, max)
    .map((x) => x.c);
}
