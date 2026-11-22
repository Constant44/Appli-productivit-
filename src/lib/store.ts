/**
 * Source de données UNIQUE : un seul `plan` lu par toutes les vues. Chaque modification passe par `apply`,
 * est enregistrée tout de suite sur l'appareil (localStorage) puis envoyée au compte (voir cloud.ts).
 */
import { create } from "zustand";
import { addDays, mondayOf, today, type ISODate } from "./dates";
import { normalize, type Plan } from "./model";
import type { Grade } from "./grades";
import { computeReview, type WeekReview } from "./review";
import { seedPlan } from "./seed";

export type QCard = { id: string; deck: "actu" | "mot" | "bio"; front: string; back: string; ref?: string; date?: string };
export type QSheet = { id: string; kind: "mot" | "bio"; title: string; body: string; sentAt: string };
export type QuizStats = Record<string, { ok: number; ko: number; last: string }>;
export type Content = { cards: QCard[]; sheets: QSheet[]; fallen: string[]; actuDays: Array<{ id: string; title: string }>; grades?: Grade[]; gradesAt?: string };

export type View = "jour" | "semaine" | "mois" | "annee" | "vendredi";
export type Toast = { id: number; text: string; undo?: boolean; tone?: "ok" | "info" | "warn" };
export type CloudState = { status: "local" | "sync" | "ok" | "error"; msg?: string; at?: number };

type Saved = { plan: Plan; savedAt: number; quiz: QuizStats };

const KEY = "pfc2-state";
const CONTENT_KEY = "pfc2-content";

const load = (): Saved | null => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return s?.plan?.v === 2 ? { ...s, plan: normalize(s.plan) } : null;
  } catch {
    return null;
  }
};
const loadContent = (): Content => {
  try {
    return JSON.parse(localStorage.getItem(CONTENT_KEY) ?? "null") ?? { cards: [], sheets: [], fallen: [], actuDays: [] };
  } catch {
    return { cards: [], sheets: [], fallen: [], actuDays: [] };
  }
};

type State = {
  plan: Plan;
  savedAt: number;
  quiz: QuizStats;
  content: Content;
  history: Plan[];
  view: View;
  date: ISODate;
  toasts: Toast[];
  cloud: CloudState;
  apply: (fn: (p: Plan) => Plan, msg?: string) => void;
  undo: () => void;
  setPlan: (plan: Plan, savedAt: number, quiz?: QuizStats) => void;
  setContent: (c: Content) => void;
  rateCard: (id: string, ok: boolean) => void;
  go: (view: View, date?: ISODate) => void;
  toast: (text: string, o?: Partial<Toast>) => void;
  dismiss: (id: number) => void;
};

const initial = load();

export const useStore = create<State>((set, get) => ({
  plan: initial?.plan ?? seedPlan(),
  savedAt: initial?.savedAt ?? 0,
  quiz: initial?.quiz ?? {},
  content: loadContent(),
  history: [],
  view: "jour",
  date: today(),
  toasts: [],
  cloud: { status: "local" },

  apply: (fn, msg) => {
    const prev = get().plan;
    const next = fn(prev);
    if (next === prev) return;
    set({ plan: next, savedAt: Date.now(), history: [...get().history.slice(-19), prev] });
    if (msg) get().toast(msg, { undo: true });
  },
  undo: () => {
    const h = get().history;
    if (!h.length) return;
    set({ plan: h[h.length - 1], history: h.slice(0, -1), savedAt: Date.now() });
    get().toast("Modification annulée", { tone: "info" });
  },
  setPlan: (plan, savedAt, quiz) => set({ plan, savedAt, history: [], ...(quiz ? { quiz } : {}) }),
  setContent: (content) => {
    set({ content });
    try {
      localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
    } catch {
      /* stockage indisponible */
    }
  },
  rateCard: (id, ok) => {
    const q = { ...get().quiz };
    const s = q[id] ?? { ok: 0, ko: 0, last: "" };
    q[id] = { ok: s.ok + (ok ? 1 : 0), ko: s.ko + (ok ? 0 : 1), last: today() };
    set({ quiz: q, savedAt: Date.now() });
  },
  go: (view, date) => set({ view, ...(date ? { date } : {}) }),
  toast: (text, o) => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone: "ok", ...o }] });
    setTimeout(() => get().dismiss(id), o?.undo ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// sauvegarde immédiate sur l'appareil
useStore.subscribe((s, prev) => {
  if (s.plan === prev.plan && s.quiz === prev.quiz) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ plan: s.plan, savedAt: s.savedAt, quiz: s.quiz } satisfies Saved));
  } catch {
    /* stockage plein ou bloqué : la sauvegarde en ligne prend le relais */
  }
});

/** Première semaine suivie par l'appli. */
export const FIRST_WEEK = "2026-11-23";

/**
 * Fige le bilan des semaines terminées (historique conservé même si tu modifies ensuite le planning).
 * Le bilan d'une semaine en cours est toujours recalculé en direct.
 */
export function freezeReviews() {
  const { plan, apply } = useStore.getState();
  const t = today();
  const current = mondayOf(t);
  const missing: ISODate[] = [];
  for (let w = FIRST_WEEK; w < current; w = addDays(w, 7)) if (!plan.reviews[w]) missing.push(w);
  if (!missing.length) return;
  apply((p) => {
    const reviews = { ...p.reviews };
    for (const w of missing) {
      const prev = reviews[addDays(w, -7)] as WeekReview | undefined;
      reviews[w] = { ...computeReview(p, w, t, prev), frozenAt: new Date().toISOString() };
    }
    return { ...p, reviews };
  });
}
