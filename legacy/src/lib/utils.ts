export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Générateur pseudo-aléatoire déterministe (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(arr: T[], r: () => number = Math.random) => arr[Math.floor(r() * arr.length)];

// ---------- Dates ----------
export const DAY = 864e5;

export const startOfDay = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isoDay = (d: Date | string) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/** Lundi de la semaine contenant d */
export const startOfWeek = (d: Date | string) => {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
};

export const addDays = (d: Date | string, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Nombre de jours (entiers, calendaires) de aujourd'hui à d. Négatif si passé. */
export const daysUntil = (d: Date | string, now = new Date()) =>
  Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const fmtDay = (d: Date | string) => {
  const x = new Date(d);
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()}/${String(x.getMonth() + 1).padStart(2, "0")}`;
};
export const fmtTime = (d: Date | string) => {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}h${String(x.getMinutes()).padStart(2, "0")}`;
};
export const fmtRelDay = (d: Date | string) => {
  const n = daysUntil(d);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n > 1) return `dans ${n} j`;
  return `il y a ${-n} j`;
};

export const fmtMin = (min: number) => {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
};

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Montants du jeu, stockés en k€ */
export const fmtMoney = (k: number) => {
  if (Math.abs(k) >= 1000) return `${(k / 1000).toFixed(k >= 100000 ? 0 : 1).replace(".", ",")} M€`;
  return `${Math.round(k)} k€`;
};

export const subjectColor = (subject: string) => {
  let h = 0;
  for (const c of subject.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 60%)`;
};

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Compte les mots comme pour la synthèse EDHEC : un mot = ce qui est entre deux blancs, l'élision compte à part
 * (« l'État » = 2 mots), un mot composé ou une abréviation (« porte-parole », « UE ») = 1 mot. Ponctuation seule ignorée.
 */
export function countWords(text: string) {
  return text
    .split(/\s+/)
    .flatMap((t) => t.split(/(?<=['’])/))
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}
