/**
 * Routines du matin et du soir : types et étapes par défaut (sans dépendance, pour éviter les imports circulaires).
 */
import type { ISODate } from "./dates";

export type RoutineAction = "wake" | "screens" | "lecture" | "bed";
export type RoutineStep = {
  id: string;
  label: string;
  detail?: string;
  /** minutes par rapport au lever (matin, ≥ 0) ou à l'extinction (soir, ≤ 0) */
  at: number;
  action?: RoutineAction;
};
export type Routines = { matin: RoutineStep[]; soir: RoutineStep[] };
export type RoutineKind = keyof Routines;
/** Étapes cochées par jour (matin) ou par soir ; `lu` : réponse du matin à « as-tu lu hier soir ? ». */
export type RoutineLog = Record<ISODate, { matin?: string[]; soir?: string[]; lu?: boolean }>;

export const DEFAULT_ROUTINES: Routines = {
  soir: [
    { id: "s-close", at: -60, label: "Fermer la journée dans Cadence", detail: "Valide ce qui est fait, reporte le reste. 2 minutes, pas plus." },
    { id: "s-prep", at: -55, label: "Préparer demain", detail: "Regarde ta 1re séance de demain, fais ton sac, dégage le bureau." },
    { id: "s-screens", at: -45, label: "Écrans coupés : téléphone en charge loin du lit", detail: "Ne pas déranger, réveil réglé et posé à l'autre bout de la chambre. C'est la dernière chose que tu fais sur un écran.", action: "screens" },
    { id: "s-shower", at: -40, label: "Douche chaude, dents, lumière tamisée", detail: "La douche chaude aide à s'endormir : le corps se refroidit ensuite." },
    { id: "s-read", at: -30, label: "Lecture au lit, livre papier, 20 à 30 min", action: "lecture" },
    { id: "s-bed", at: 0, label: "Lumière éteinte", action: "bed" },
  ],
  matin: [
    { id: "m-up", at: 0, label: "Debout à la 1re sonnerie", detail: "Le réveil est loin du lit : tu te lèves pour l'éteindre. Pas de snooze.", action: "wake" },
    { id: "m-light", at: 1, label: "Lumière à fond et un grand verre d'eau", detail: "Rideaux ouverts, toutes les lumières, 2 min à la fenêtre. C'est la lumière du matin qui t'aidera à dormir tôt le soir." },
    { id: "m-shower", at: 5, label: "Lit fait, douche, habillé" },
    { id: "m-breakfast", at: 15, label: "Petit-déjeuner, sans téléphone" },
    { id: "m-plan", at: 27, label: "Cadence : regarder tes 3 essentiels", detail: "Une minute. Tu sais ce que tu fais en premier." },
    { id: "m-nosocial", at: 30, label: "Pas de réseaux avant la fin de ta 1re séance" },
  ],
};
