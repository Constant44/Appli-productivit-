/** État d'interface partagé (fenêtres ouvertes). Les données, elles, ne vivent que dans store.ts. */
import { create } from "zustand";
import type { ISODate } from "./dates";
import type { Activity } from "./model";

export type Sheet =
  | { kind: "new"; defaults: Partial<Activity> }
  | { kind: "edit"; key: string }
  | { kind: "item"; key: string }
  | { kind: "postpone"; key: string }
  | { kind: "settings" }
  | { kind: "replan"; date: ISODate }
  | { kind: "help" }
  | { kind: "copy"; id?: string; cat?: string }
  /** noter une sortie de course (faite avec la montre ou sans le guidage du téléphone) */
  | { kind: "runlog"; key?: string; date?: ISODate };

type UI = {
  sheet: Sheet | null;
  open: (s: Sheet) => void;
  close: () => void;
  reviewWeek: ISODate | null;
  setReviewWeek: (w: ISODate | null) => void;
  weekTab: "planning" | "bilan";
  setWeekTab: (t: "planning" | "bilan") => void;
  focusMin: boolean;
  setFocusMin: (v: boolean) => void;
};

export const useUI = create<UI>((set) => ({
  sheet: null,
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  reviewWeek: null,
  setReviewWeek: (reviewWeek) => set({ reviewWeek }),
  weekTab: "planning",
  setWeekTab: (weekTab) => set({ weekTab }),
  focusMin: false,
  setFocusMin: (focusMin) => set({ focusMin }),
}));
