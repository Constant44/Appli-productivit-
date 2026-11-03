/** Célébrations déclenchées par le store : fin de tâche, fin de session, travaux, montée de niveau. */
import { create } from "zustand";

export type BurstKind = "task" | "goal" | "build" | "levelup";
export type Shooter = { name: string; num: number; pos: string; ovr: number };
export type Burst = { id: number; kind: BurstKind; title: string; sub?: string; xp?: number; coins?: number; shooter?: Shooter; side?: -1 | 1 };

export const useFx = create<{ burst: Burst | null }>(() => ({ burst: null }));

let n = 0;
export function celebrate(kind: BurstKind, title: string, sub?: string, extra?: { xp?: number; coins?: number; shooter?: Shooter }) {
  useFx.setState({ burst: { id: ++n, kind, title, sub, side: Math.random() < 0.5 ? -1 : 1, ...extra } });
}
export const clearBurst = () => useFx.setState({ burst: null });
