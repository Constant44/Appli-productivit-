/**
 * Mode Focus : une séance à la fois, plein écran, minuteur, compteur de décrochages, puis validation du temps
 * réellement fait et pause sans écran. L'état survit à un rechargement (calculé à partir des horodatages).
 */
import { create } from "zustand";
import { cancelAlarm, logBlock, scheduleAlarm } from "./calendar";
import { findOcc, markDone, type Occ } from "./model";
import { useRun } from "./runSession";
import { useStore } from "./store";

export type FocusPhase = "work" | "review" | "break";
export type FocusSession = {
  key: string;
  title: string;
  cat: string;
  notes?: string;
  phase: FocusPhase;
  plannedMin: number;
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
  distractions: number;
  /** minutes réellement faites (figées à la fin de la phase de travail) */
  workedMin?: number;
  breakMin?: number;
};

const KEY = "cadence-focus";
const load = (): FocusSession | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const save = (s: FocusSession | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
};

export const elapsedMs = (s: FocusSession, now = Date.now()) => now - s.startedAt - s.pausedMs - (s.pausedAt ? now - s.pausedAt : 0);

type F = {
  session: FocusSession | null;
  start: (o: Occ) => void;
  pause: () => void;
  resume: () => void;
  distract: () => void;
  finishWork: () => void;
  validate: (minutes: number) => void;
  startBreak: (min?: number) => void;
  stop: () => void;
};

export const useFocus = create<F>((set, get) => {
  const put = (s: FocusSession | null) => {
    save(s);
    set({ session: s });
  };
  return {
    session: load(),
    start: (o) => {
      // une séance de course se lance dans le mode course guidé
      if (o.cat === "course") {
        useRun.getState().start(o);
        return;
      }
      const plannedMin = Math.max(5, Math.min(o.minutes || 45, 90));
      const s: FocusSession = { key: o.key, title: o.title, cat: o.cat, notes: o.notes, phase: "work", plannedMin, startedAt: Date.now(), pausedMs: 0, distractions: 0 };
      put(s);
      void scheduleAlarm(Date.now() + plannedMin * 60000, `Séance terminée : ${o.title}`);
    },
    pause: () => {
      const s = get().session;
      if (!s || s.pausedAt) return;
      put({ ...s, pausedAt: Date.now() });
      void cancelAlarm();
    },
    resume: () => {
      const s = get().session;
      if (!s?.pausedAt) return;
      const next = { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: undefined };
      put(next);
      if (next.phase === "work") void scheduleAlarm(Date.now() + (next.plannedMin * 60000 - elapsedMs(next)), `Séance terminée : ${s.title}`);
    },
    distract: () => {
      const s = get().session;
      if (s) put({ ...s, distractions: s.distractions + 1 });
    },
    finishWork: () => {
      const s = get().session;
      if (!s || s.phase !== "work") return;
      const worked = Math.max(1, Math.round(Math.min(elapsedMs(s), s.plannedMin * 60000 * 1.5) / 60000));
      put({ ...s, phase: "review", workedMin: worked, pausedAt: undefined });
      void cancelAlarm(true);
    },
    validate: (minutes) => {
      const s = get().session;
      if (!s) return;
      const { apply } = useStore.getState();
      apply((p) => markDone(p, s.key, minutes, { focus: true, distractions: s.distractions }), `Séance validée : ${minutes} min`);
      const occ = findOcc(useStore.getState().plan, s.key);
      if (occ) void logBlock(occ.title, minutes, s.distractions);
      get().startBreak();
    },
    startBreak: (min = 5) => {
      const s = get().session;
      if (!s) return;
      put({ ...s, phase: "break", breakMin: min, startedAt: Date.now(), pausedMs: 0, pausedAt: undefined });
      void scheduleAlarm(Date.now() + min * 60000, "Pause terminée : on y retourne");
    },
    stop: () => {
      put(null);
      void cancelAlarm();
    },
  };
});
