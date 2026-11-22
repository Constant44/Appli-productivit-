/**
 * Où, quand et sur quoi tu te concentres le mieux : moyenne de la concentration notée sur 10 en fin de session,
 * par lieu, par moment de la journée et par matière (pondérée par la durée des sessions).
 */
import type { Session } from "./types";

export const MIN_SESSIONS = 3;

export type FocusRow = { key: string; avg: number; n: number; minutes: number };

export const SLOTS: Array<[string, number, number]> = [["Matin", 5, 12], ["Après-midi", 12, 18], ["Soir", 18, 22], ["Tard le soir", 22, 29]];
export const slotOf = (iso: string) => {
  const h = new Date(iso).getHours();
  const hh = h < 5 ? h + 24 : h;
  return SLOTS.find(([, a, b]) => hh >= a && hh < b)?.[0] ?? "Tard le soir";
};

function group(sessions: Session[], keyOf: (s: Session) => string | undefined): FocusRow[] {
  const m = new Map<string, { w: number; sum: number; n: number }>();
  for (const s of sessions) {
    const k = keyOf(s);
    if (!k || s.focus10 == null) continue;
    const g = m.get(k) ?? { w: 0, sum: 0, n: 0 };
    g.w += s.minutes; g.sum += s.focus10 * s.minutes; g.n++;
    m.set(k, g);
  }
  return [...m.entries()].map(([key, g]) => ({ key, avg: g.w ? g.sum / g.w : 0, n: g.n, minutes: g.w })).sort((a, b) => b.avg - a.avg);
}

export function focusInsights(sessions: Session[]) {
  const rated = sessions.filter((s) => s.focus10 != null);
  const byPlace = group(rated, (s) => s.place);
  const bySlot = group(rated, (s) => slotOf(s.start));
  const bySubject = group(rated, (s) => s.subject);
  const byCombo = group(rated, (s) => (s.place ? `${slotOf(s.start)}|${s.place}` : undefined)).map((r) => ({ ...r, key: comboLabel(r.key) }));
  const ok = (l: FocusRow[]) => l.filter((r) => r.n >= MIN_SESSIONS);
  const overall = rated.length ? rated.reduce((a, s) => a + (s.focus10 ?? 0) * s.minutes, 0) / Math.max(1, rated.reduce((a, s) => a + s.minutes, 0)) : NaN;
  return { rated: rated.length, overall, byPlace, bySlot, bySubject, best: ok(byCombo)[0], worstSubject: ok(bySubject).slice(-1)[0] };
}

const SLOT_PHRASE: Record<string, string> = { "Matin": "le matin", "Après-midi": "l'après-midi", "Soir": "le soir", "Tard le soir": "tard le soir" };
/** « le matin, à la BU », « le soir, chez moi », « l'après-midi, au lycée ». */
function comboLabel(key: string) {
  const [slot, place] = key.split("|");
  const p = place.trim();
  const where = /^chez /i.test(p) ? p.toLowerCase() : /^(bu|bibli|salle|maison)/i.test(p) ? `à la ${p}` : /^lycée/i.test(p) ? `au ${p.toLowerCase()}` : `à ${p}`;
  return `${SLOT_PHRASE[slot] ?? slot.toLowerCase()}, ${where}`;
}

/** Lieux déjà utilisés, du plus récent au plus ancien, complétés par des suggestions. */
export function knownPlaces(sessions: Session[]): string[] {
  const seen: string[] = [];
  for (const s of [...sessions].sort((a, b) => b.start.localeCompare(a.start))) if (s.place && !seen.includes(s.place)) seen.push(s.place);
  for (const p of ["BU", "Chez moi", "Lycée", "BU Médecine"]) if (!seen.includes(p)) seen.push(p);
  return seen.slice(0, 8);
}
