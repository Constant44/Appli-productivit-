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
  /** seulement certains jours (0 = lundi) ; absent = tous les jours */
  days?: number[];
};
export type Routines = { matin: RoutineStep[]; soir: RoutineStep[] };
export type RoutineKind = keyof Routines;
/** Étapes cochées par jour (matin) ou par soir ; `lu` : réponse du matin à « as-tu lu hier soir ? ». */
export type RoutineLog = Record<ISODate, { matin?: string[]; soir?: string[]; lu?: boolean }>;

export const DEFAULT_ROUTINES: Routines = {
  soir: [
    { id: "s-chores", at: -75, label: "Vaisselle faite et vêtements rangés", detail: "Normalement fait juste après le dîner. Sinon, maintenant : 10 min, pas plus." },
    { id: "s-close", at: -60, label: "Fermer la journée dans Cadence", detail: "Valide ce qui est fait, reporte le reste. 2 minutes, pas plus." },
    { id: "s-prep", at: -55, label: "Préparer demain", detail: "Sac fait, vêtements de demain sortis, regarde ta 1re séance." },
    { id: "s-screens", at: -45, label: "Écrans coupés : téléphone en charge loin du lit", detail: "Ne pas déranger, réveil réglé et posé à l'autre bout de la chambre. C'est la dernière chose que tu fais sur un écran.", action: "screens" },
    { id: "s-teeth", at: -40, label: "Dents, lumière tamisée" },
    { id: "s-read", at: -30, label: "Lecture au lit, livre papier, 20 à 30 min", action: "lecture" },
    { id: "s-bed", at: 0, label: "Lumière éteinte", action: "bed" },
  ],
  matin: [
    { id: "m-up", at: 0, label: "Debout à la 1re sonnerie", detail: "Le réveil est loin du lit : tu te lèves pour l'éteindre. Pas de snooze.", action: "wake" },
    { id: "m-shower", at: 1, label: "Douche directe", detail: "Tout de suite, sans réfléchir : c'est elle qui te réveille." },
    { id: "m-light", at: 12, label: "Lumières à fond et un grand verre d'eau", detail: "Rideaux ouverts, toutes les lumières. C'est la lumière du matin qui t'aidera à dormir tôt le soir." },
    { id: "m-breakfast", at: 15, label: "Petit-déj : 2 œufs, sans téléphone" },
    { id: "m-actu", at: 25, days: [4], label: "Quiz du test d'actu avec Claude", detail: "Actu de la semaine, mots, persos : demande « interroge-moi », une question à la fois." },
    { id: "m-plan", at: 35, label: "Cadence : tes 3 essentiels", detail: "Une minute. Tu sais ce que tu fais en premier." },
    { id: "m-nosocial", at: 36, label: "Pas de réseaux avant la fin de ta 1re séance" },
  ],
};
