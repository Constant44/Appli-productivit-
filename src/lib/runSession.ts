/**
 * Séance de course en cours : calculée à partir des horodatages, donc juste même si l'écran s'éteint
 * ou si la page se recharge pendant la sortie.
 */
import { create } from "zustand";
import { today } from "./dates";
import type { Occ } from "./model";
import { blocksTotal, completedAt, nextSession, positionAt, recordRun, runSecAt, sessionOf, type Feel } from "./run";
import { useStore } from "./store";

export type ActiveRun = {
  n: number;
  occKey?: string;
  startedAt: number;
  pausedMs: number;
  pausedAt?: number;
  /** secondes sautées avec « bloc suivant » */
  skipped: number;
  /** séance arrêtée : on attend le ressenti */
  stoppedAt?: number;
};

const KEY = "cadence-run";
const load = (): ActiveRun | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const save = (s: ActiveRun | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
};

/** Secondes écoulées dans la séance (pauses exclues, sauts inclus). */
export function elapsedSec(r: ActiveRun, now = Date.now()) {
  const end = r.stoppedAt ?? now;
  const paused = r.pausedMs + (r.pausedAt ? end - r.pausedAt : 0);
  const s = (end - r.startedAt - paused) / 1000 + r.skipped;
  return Math.max(0, Math.min(s, blocksTotal(sessionOf(r.n))));
}

type R = {
  active: ActiveRun | null;
  start: (o?: Occ, n?: number) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  finish: (feel: Feel) => void;
  cancel: () => void;
};

export const useRun = create<R>((set, get) => {
  const put = (s: ActiveRun | null) => {
    save(s);
    set({ active: s });
  };
  return {
    active: load(),
    start: (o, n) => {
      const num = n ?? nextSession(useStore.getState().plan.run, today()).n;
      put({ n: num, occKey: o?.key, startedAt: Date.now(), pausedMs: 0, skipped: 0 });
    },
    pause: () => {
      const r = get().active;
      if (r && !r.pausedAt && !r.stoppedAt) put({ ...r, pausedAt: Date.now() });
    },
    resume: () => {
      const r = get().active;
      if (r?.pausedAt) put({ ...r, pausedMs: r.pausedMs + (Date.now() - r.pausedAt), pausedAt: undefined });
    },
    skip: () => {
      const r = get().active;
      if (!r || r.stoppedAt) return;
      const pos = positionAt(sessionOf(r.n), elapsedSec(r));
      put({ ...r, skipped: r.skipped + pos.left });
    },
    stop: () => {
      const r = get().active;
      if (r && !r.stoppedAt) put({ ...r, stoppedAt: Date.now() });
    },
    finish: (feel) => {
      const r = get().active;
      if (!r) return;
      const s = sessionOf(r.n);
      const el = elapsedSec(r);
      const completed = completedAt(s, el);
      const runSec = runSecAt(s, el);
      const at = new Date();
      const { apply } = useStore.getState();
      apply(
        (p) => recordRun(p, { date: today(), at: at.toISOString(), session: r.n, completed, feel, runSec, totalSec: Math.round(el) }, r.occKey),
        completed && feel < 4 ? `Séance ${r.n} validée. Prochaine : séance ${Math.min(r.n + 1, 33)}.` : `Séance ${r.n} enregistrée. La prochaine fois, on la refait : c'est la méthode.`,
      );
      put(null);
    },
    cancel: () => put(null),
  };
});
