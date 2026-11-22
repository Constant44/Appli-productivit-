/** Dates « locales » au format AAAA-MM-JJ : aucune heure, aucun fuseau, comparables comme des chaînes. */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export const iso = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: ISODate) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const today = (): ISODate => iso(new Date());
export const addDays = (s: ISODate, n: number): ISODate => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const addMonths = (s: ISODate, n: number): ISODate => {
  const d = parse(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return iso(d);
};
/** 0 = lundi … 6 = dimanche */
export const weekday = (s: ISODate) => (parse(s).getDay() + 6) % 7;
export const mondayOf = (s: ISODate) => addDays(s, -weekday(s));
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const range = (from: ISODate, to: ISODate): ISODate[] => {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
export const monthStart = (s: ISODate) => `${s.slice(0, 7)}-01`;
export const monthEnd = (s: ISODate) => addDays(addMonths(monthStart(s), 1), -1);

/** "HH:MM" ↔ minutes depuis minuit */
export const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fromMin = (m: number) => {
  const c = Math.max(0, Math.min(24 * 60 - 1, Math.round(m)));
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
};
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DAY_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export const fmtLong = (s: ISODate) => {
  const d = parse(s);
  return `${DAY_LONG[weekday(s)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtShort = (s: ISODate) => {
  const d = parse(s);
  return `${DAY_SHORT[weekday(s)]} ${d.getDate()}/${d.getMonth() + 1}`;
};
export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const fmtDM = (s: ISODate) => {
  const d = parse(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
export const fmtDur = (min: number) => {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${pad(r)}` : `${h} h`;
};
export const fmtHours = (min: number) => {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
};

/** Vacances scolaires (zone A, Bordeaux) : pas de cours. */
export const HOLIDAYS: Array<[ISODate, ISODate]> = [
  ["2026-10-17", "2026-11-01"],
  ["2026-12-19", "2027-01-03"],
  ["2027-02-13", "2027-02-28"],
  ["2027-04-10", "2027-04-25"],
];
export const inHolidays = (s: ISODate) => HOLIDAYS.some(([a, b]) => s >= a && s <= b);
