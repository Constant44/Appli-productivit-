/** Effets de célébration (mascotte) déclenchés par le store : fin de tâche, fin de session, travaux, montée de niveau. */
import { create } from "zustand";

export type BurstKind = "cheese" | "goal" | "build" | "levelup";
export type Burst = { id: number; kind: BurstKind; title: string; sub?: string };

export const useFx = create<{ burst: Burst | null }>(() => ({ burst: null }));

let n = 0;
export function celebrate(kind: BurstKind, title: string, sub?: string) {
  useFx.setState({ burst: { id: ++n, kind, title, sub } });
}
export const clearBurst = () => useFx.setState({ burst: null });
