/**
 * Planning de départ, construit à partir de tes réponses (tout est modifiable dans l'appli).
 *
 * Principes : le gros du travail entre 9 h et 19 h (BU, tu es lucide), séances de 45 min avec 10 min de pause,
 * jamais plus de 2 séances d'affilée de la même matière, matières lourdes réparties sur la semaine,
 * soir léger (actu, lecture), pas de travail après 22 h, dîner limité à 45 min, créneaux libres le vendredi soir
 * et le samedi soir, dimanche = gros jour. Coucher visé : 23 h 15 la veille d'un cours à 8 h.
 */
import type { Activity, Category, Goal, Override, Plan, Prio, Repeat } from "./model";
import { DEFAULT_PREFS, keyOf } from "./model";
import { DEFAULT_ROUTINES } from "./routineDefaults";
import { RUN_CATEGORY, RUN_GOAL, runSeries } from "./runSetup";

export const CATEGORIES: Category[] = [
  { id: "maths", name: "Maths", color: "#2F6BFF", tracked: true },
  { id: "micro", name: "Micro", color: "#FF7A1A", tracked: true },
  { id: "synthese", name: "Synthèse EDHEC", color: "#A6F51C", tracked: true },
  { id: "anglais", name: "Anglais", color: "#19D3F5", tracked: true },
  { id: "macro", name: "Macro · éco monétaire", color: "#FFD21F", tracked: true },
  { id: "gestion", name: "Gestion", color: "#17C08A", tracked: true },
  { id: "espagnol", name: "Espagnol", color: "#FF5C8A", tracked: true },
  { id: "actu", name: "Actu · mots · persos", color: "#9B7BFF", tracked: true },
  { id: "anki", name: "Anki", color: "#E86BF0", tracked: true },
  { id: "sport", name: "Sport", color: "#4ADE52", tracked: true },
  { ...RUN_CATEGORY },
  { id: "lecture", name: "Lecture", color: "#F2C894", tracked: true },
  { id: "cours", name: "Cours", color: "#6B7A99", tracked: false },
  { id: "eval", name: "Khôlles · DS · rendus", color: "#FF3B4E", tracked: false },
  { id: "vie", name: "Vie (repas, routines)", color: "#4A5568", tracked: false },
  { id: "libre", name: "Temps libre", color: "#2DD4BF", tracked: false },
];

const START = "2026-11-22";
const END = "2027-04-03";
const [LU, MA, ME, JE, VE, SA, DI] = [0, 1, 2, 3, 4, 5, 6];

let n = 0;
function S(
  title: string, cat: string, prio: Prio, days: number[], start: string, end: string,
  o: { check?: boolean; every?: 1 | 2; from?: string; skipHolidays?: boolean; notes?: string } = {},
): Activity {
  const repeat: Repeat = { days, every: o.every ?? 1, until: END, ...(o.skipHolidays ? { skipHolidays: true } : {}) };
  return {
    id: `s${++n}-${cat}`, title, cat, prio, date: o.from ?? START, start, end, repeat,
    check: o.check ?? !["cours", "vie", "libre", "eval"].includes(cat), notes: o.notes, source: "seed",
  };
}
function O(
  id: string, title: string, cat: string, date: string, start?: string, end?: string,
  o: { prio?: Prio; check?: boolean; deadline?: boolean; minutes?: number; notes?: string; source?: Activity["source"] } = {},
): Activity {
  return {
    id, title, cat, prio: o.prio ?? (cat === "eval" ? "fixe" : "important"), date, start, end, minutes: o.minutes,
    check: o.check ?? !["cours", "vie", "libre", "eval"].includes(cat), deadline: o.deadline, notes: o.notes, source: o.source ?? "seed",
  };
}

export const WEEK_TEMPLATE: Activity[] = [
  // ---------- cours (pas pendant les vacances)
  S("Gestion / Micro (M. Brandenburg)", "cours", "fixe", [MA], "08:00", "12:00", { skipHolidays: true, from: "2026-11-24" }),
  S("Maths", "cours", "fixe", [MA], "13:00", "15:00", { skipHolidays: true, from: "2026-11-24" }),
  S("Anglais (Mme Terroni)", "cours", "fixe", [MA], "15:00", "17:00", { skipHolidays: true, from: "2026-11-24" }),
  S("Macro (Mme Millaret)", "cours", "fixe", [ME], "08:00", "11:00", { skipHolidays: true, from: "2026-11-25" }),
  S("Espagnol (Mme Lasserre)", "cours", "fixe", [ME], "14:00", "16:00", { skipHolidays: true, every: 2, from: "2026-11-25" }),
  S("TD Économie monétaire (fac)", "cours", "fixe", [JE], "09:45", "11:15", { skipHolidays: true, from: "2026-11-26" }),
  S("Test d'actu", "eval", "fixe", [VE], "08:00", "08:10", { skipHolidays: true, from: "2026-11-27", notes: "Juste avant les maths." }),
  S("Maths", "cours", "fixe", [VE], "08:05", "10:00", { skipHolidays: true, from: "2026-11-27" }),
  S("Micro / Gestion", "cours", "fixe", [VE], "10:00", "12:00", { skipHolidays: true, from: "2026-11-27" }),

  // ---------- routines et repas
  S("Routine du matin : lever, douche, petit-déj", "vie", "important", [MA, ME, VE], "07:15", "07:45"),
  S("Routine du matin : lever, petit-déj, départ BU", "vie", "important", [LU, JE], "08:00", "08:40"),
  S("Routine du matin", "vie", "facultatif", [SA, DI], "10:00", "10:30"),
  S("Déjeuner (Crous)", "vie", "fixe", [MA, JE, VE], "12:00", "12:45"),
  S("Déjeuner (Crous)", "vie", "fixe", [ME], "11:15", "12:00"),
  S("Déjeuner", "vie", "fixe", [LU, SA, DI], "12:30", "13:15"),
  S("Dîner (45 min max)", "vie", "fixe", [LU, MA, ME, JE, VE, SA, DI], "18:45", "19:30"),
  S("Lecture au lit (livre papier) · extinction 23 h 15", "lecture", "important", [DI, LU, MA, JE], "22:45", "23:15",
    { notes: "Téléphone en charge loin du lit depuis 22 h 30, réveil à l'autre bout de la chambre. Pas d'écran." }),

  // ---------- LUNDI : journée BU (9 h–19 h)
  S("Maths : exercices", "maths", "important", [LU], "09:15", "10:00"),
  S("Maths : exercices (suite)", "maths", "important", [LU], "10:10", "10:55"),
  S("Micro : reprendre le cours + 2 exos", "micro", "important", [LU], "11:05", "11:50"),
  S("Synthèse EDHEC", "synthese", "important", [LU], "13:30", "14:15"),
  S("Macro · éco monétaire : fiche du dernier cours", "macro", "important", [LU], "14:25", "15:10"),
  S("Anki : toutes les cartes dues", "anki", "important", [LU], "15:20", "15:50"),
  S("Sport : Basic-Fit renfo (après la course)", "sport", "important", [LU], "16:55", "17:30", { notes: "Juste après ta séance de course. 35 min de renfo." }),
  S("Espagnol : vocabulaire + grammaire", "espagnol", "facultatif", [LU], "17:30", "18:15"),

  // ---------- MARDI : cours 8 h–17 h (khôlles souvent 17 h–19 h)
  S("Anki : toutes les cartes dues", "anki", "important", [MA], "17:15", "17:45"),
  S("Maths : refaire les exos du cours du jour", "maths", "important", [MA], "17:55", "18:40"),
  S("Micro : exercices", "micro", "facultatif", [MA], "20:30", "21:15"),

  // ---------- MERCREDI : macro 8 h–11 h (+ espagnol une semaine sur deux)
  S("Macro : reprendre le cours du matin", "macro", "important", [ME], "12:15", "13:00"),
  S("Micro : exercices", "micro", "important", [ME], "13:10", "13:55"),
  S("Maths : exercices", "maths", "important", [ME], "14:10", "14:55", { every: 2, from: "2026-12-02" }),
  S("Anglais : texte de presse + vocabulaire", "anglais", "important", [ME], "16:15", "17:00"),
  S("Synthèse EDHEC", "synthese", "important", [ME], "17:10", "17:55"),
  S("Anki : toutes les cartes dues", "anki", "important", [ME], "18:00", "18:30"),

  // ---------- JEUDI : TD 9 h 45–11 h 15
  S("Maths : exercices", "maths", "important", [JE], "08:50", "09:35"),
  S("Micro : exercices", "micro", "important", [JE], "11:30", "12:00"),
  S("Anglais : thème / version", "anglais", "important", [JE], "13:15", "14:00"),
  S("Gestion : reprendre le cours", "gestion", "important", [JE], "14:10", "14:55"),
  S("Sport : Basic-Fit renfo (après la course)", "sport", "important", [JE], "16:10", "16:50", { notes: "Juste après ta séance de course. 40 min de renfo." }),
  S("Anki : toutes les cartes dues", "anki", "important", [JE], "17:00", "17:30"),
  S("Révision test d'actu : actu de la semaine + mots / persos (onglet Vendredi)", "actu", "important", [JE], "20:00", "21:15"),

  // ---------- VENDREDI : test 8 h, cours, DS certains après-midi
  S("Anki : toutes les cartes dues", "anki", "important", [VE], "17:30", "18:00"),
  S("Soirée libre", "libre", "facultatif", [VE], "19:30", "23:30"),

  // ---------- SAMEDI : léger, soirée possible
  S("Maths : exercices", "maths", "important", [SA], "11:00", "11:45"),
  S("Micro : exercices", "micro", "important", [SA], "11:55", "12:40"),
  S("Anglais : méthode de khôlle / oral", "anglais", "facultatif", [SA], "14:00", "14:45"),
  S("Synthèse EDHEC", "synthese", "important", [SA], "14:55", "15:40"),
  S("Anki : toutes les cartes dues", "anki", "important", [SA], "15:50", "16:20"),
  S("Espagnol : exercices", "espagnol", "facultatif", [SA], "16:30", "17:15"),
  S("Temps libre / soirée", "libre", "facultatif", [SA], "19:30", "23:59"),

  // ---------- DIMANCHE : le gros jour
  S("Maths : exercices", "maths", "important", [DI], "10:45", "11:30"),
  S("Maths : exercices (suite)", "maths", "important", [DI], "11:40", "12:25"),
  S("Micro : exercices", "micro", "important", [DI], "13:45", "14:30"),
  S("Macro · éco monétaire", "macro", "important", [DI], "14:40", "15:25"),
  S("Sport : renfo sur le tapis (25 min)", "sport", "important", [DI], "15:35", "16:00"),
  S("Gestion : exercices", "gestion", "facultatif", [DI], "16:15", "17:00"),
  S("Anki : toutes les cartes dues", "anki", "important", [DI], "17:10", "17:40"),
  S("Bilan de la semaine + coup d'œil sur la suivante (onglet Semaine)", "vie", "important", [DI], "20:00", "20:20", { check: true }),

  // ---------- chaque soir : l'actu du jour (10 min), sauf jeudi (grosse révision) et vendredi
  S("Lire l'actu du jour (doc Drive)", "actu", "important", [LU, MA, ME, SA, DI], "20:30", "20:45"),
];

/** Échéances (khôlles, DS, rendus, concours). Les khôlles et DS viennent de ton Google Agenda. */
export const CONF_NOTE = "Simple conférence, pas une épreuve. Prends des notes : le DS de prépa entretien du 9/12 porte sur cette conférence et celle du 13/11 (mail de Mme Millaret du 12/10). Horaire à vérifier.";
export const DS_ROSSI = "DS prépa entretien : sur les 2 conférences de M. Rossi (13 et 27/11)";
export const DS_ROSSI_NOTE = "Annoncé par Mme Millaret (mail du 12/10) : « le 9 décembre sera un DS qui portera sur les deux conférences de Monsieur Rossi des 13 et 27 novembre ».";

export const DEADLINES: Activity[] = [
  O("gcal-jhgu3k3kkfdia4s3fetc3qnuik", "Khôlle de maths (T. Sageaux, F104)", "eval", "2026-11-24", "18:00", "19:00", { deadline: true, source: "gcal" }),
  O("ev-espagnol-1125", "Éval d'espagnol", "eval", "2026-11-25", "14:00", "16:00", { deadline: true }),
  O("ev-ecomon-1126", "Éval d'éco monétaire (TD 1 et 2) : à confirmer", "eval", "2026-11-26", "09:45", "11:15", { deadline: true }),
  O("gcal-d02pc7bm3j1jgilen04p5bom4c", "Conférence de M. Rossi", "cours", "2026-11-27", "13:00", "15:00", { prio: "fixe", source: "gcal", notes: CONF_NOTE }),
  O("gcal-plv8kbkii8u8rd5o7js7il707o", "Khôlle d'anglais (C. Terroni, F052)", "eval", "2026-11-30", "10:00", "12:00", { deadline: true, source: "gcal" }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20261204T120000Z", "DS de maths (4 h)", "eval", "2026-12-04", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("gcal-gj3tf6b84jsb9ho2s7l2t4fep8", DS_ROSSI, "eval", "2026-12-09", "11:00", "11:30", { deadline: true, source: "gcal", notes: DS_ROSSI_NOTE }),
  O("task-rossi-relire", "Prépa entretien : relire tes notes des 2 conférences Rossi + le texte de Furet", "cours", "2026-12-08", undefined, undefined, { minutes: 45, check: true, prio: "important", source: "inbox" }),
  O("ev-synth-1", "Synthèse EDHEC · devoir 1 à rendre · non noté, corrigé", "eval", "2026-12-09", undefined, undefined, { deadline: true, minutes: 0 }),
  O("gcal-o9s14do36as43nhkm4v7kmr0og", "Khôlle de micro (A. Brandenburg)", "eval", "2026-12-10", "17:00", "18:00", { deadline: true, source: "gcal" }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20261211T120000Z", "DS de gestion (4 h)", "eval", "2026-12-11", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("gcal-0e8ivlv9tavmdlajfoi4jb9ikk", "Khôlle d'entretien (C. Agard, E01)", "eval", "2026-12-16", "14:00", "16:00", { deadline: true, source: "gcal" }),
  O("gcal-rlufjlqu22e6l11q3g4c3ts8fg", "Khôlle de maths (D. Roumilhac, E08)", "eval", "2026-12-17", "17:00", "18:00", { deadline: true, source: "gcal" }),
  O("ev-synth-2s", "Synthèse : sujet du devoir 2 disponible (Skool)", "eval", "2026-12-18", undefined, undefined, { minutes: 0, prio: "important" }),
  O("ev-synth-2", "Synthèse EDHEC · devoir 2 à rendre · non noté, corrigé", "eval", "2027-01-08", undefined, undefined, { deadline: true, minutes: 0 }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20270108T120000Z", "DS (matière à préciser)", "eval", "2027-01-08", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("ev-synth-3s", "Synthèse : sujet du devoir 3 disponible", "eval", "2027-01-15", undefined, undefined, { minutes: 0, prio: "important" }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20270115T120000Z", "DS (matière à préciser)", "eval", "2027-01-15", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20270122T120000Z", "DS (matière à préciser)", "eval", "2027-01-22", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("gcal-27c5d2i3oatkv321ik09iosfpr_20270129T120000Z", "DS (matière à préciser)", "eval", "2027-01-29", "13:00", "17:00", { deadline: true, source: "gcal" }),
  O("ev-synth-3", "Synthèse EDHEC · devoir 3 à rendre · non noté, corrigé", "eval", "2027-02-05", undefined, undefined, { deadline: true, minutes: 0 }),
  O("ev-synth-4s", "Synthèse : sujet du devoir 4 disponible", "eval", "2027-02-22", undefined, undefined, { minutes: 0, prio: "important" }),
  O("ev-synth-4", "Synthèse EDHEC · devoir 4 à rendre · non noté, corrigé", "eval", "2027-03-15", undefined, undefined, { deadline: true, minutes: 0 }),
  O("ev-edhec", "ÉCRITS EDHEC Pré-Master", "eval", "2027-04-03", undefined, undefined, { deadline: true, minutes: 0 }),
];

/** Tâches ponctuelles des deux prochaines semaines. */
export const TASKS: Activity[] = [
  O("t-ecomon-prof", "Demander à la prof d'éco monétaire si l'éval de jeudi a lieu", "macro", "2026-11-23", undefined, undefined, { minutes: 5 }),
  O("t-skool", "Télécharger le sujet du devoir 1 de synthèse sur Skool", "synthese", "2026-11-23", undefined, undefined, { minutes: 10 }),
  O("t-esp-1", "Espagnol : réviser pour l'éval de mercredi", "espagnol", "2026-11-24", "20:30", "21:15"),
  O("t-synth-redac", "Synthèse devoir 1 : rédaction en 3 h chrono, à la main (conditions réelles)", "synthese", "2026-12-05", "14:00", "17:00"),
  O("t-synth-depot", "Synthèse devoir 1 : taper la copie et la déposer sur le Drive (« Prénom Nom - Devoir 1 »)", "synthese", "2026-12-07", undefined, undefined, { minutes: 45 }),
];

/** Ajustements de la semaine type pour les échéances proches (exceptions, la série reste intacte). */
function adjustments(acts: Activity[]): Record<string, Override> {
  const find = (title: string, day: number) => acts.find((a) => a.title === title && a.repeat?.days.includes(day))!;
  const ov: Record<string, Override> = {};
  const set = (title: string, day: number, date: string, o: Override) => (ov[keyOf(find(title, day).id, date)] = o);
  // khôlle de maths mardi 24
  set("Maths : exercices", LU, "2026-11-23", { title: "Maths : préparer la khôlle de demain (cours + exos types)" });
  set("Maths : exercices (suite)", LU, "2026-11-23", { title: "Maths : khôlle, refaire 2 exercices classiques sans le corrigé" });
  set("Maths : refaire les exos du cours du jour", MA, "2026-11-24", { deleted: true }); // khôlle 18 h–19 h
  set("Micro : exercices", MA, "2026-11-24", { deleted: true }); // remplacé par l'espagnol (éval mercredi)
  // éval d'espagnol mercredi 25
  set("Espagnol : vocabulaire + grammaire", LU, "2026-11-23", { title: "Espagnol : réviser pour l'éval de mercredi", prio: "important" });
  // éval d'éco monétaire jeudi 26 (à confirmer)
  set("Macro : reprendre le cours du matin", ME, "2026-11-25", { title: "Éco monétaire : revoir les TD 1 et 2 (éval jeudi ?)" });
  // synthèse : on part de zéro
  set("Synthèse EDHEC", LU, "2026-11-23", { title: "Synthèse : lire la méthode sur Skool et la ficher" });
  set("Synthèse EDHEC", ME, "2026-11-25", { title: "Synthèse : finir la fiche méthode + lire les textes du devoir 1" });
  set("Synthèse EDHEC", SA, "2026-11-28", { title: "Synthèse devoir 1 : analyser les textes, tableau de confrontation" });
  set("Synthèse EDHEC", LU, "2026-11-30", { title: "Synthèse devoir 1 : plan détaillé" });
  set("Synthèse EDHEC", ME, "2026-12-02", { title: "Synthèse : relire la méthode (intro, transitions, conclusion)" });
  // khôlle d'anglais lundi 30
  set("Anglais : méthode de khôlle / oral", SA, "2026-11-28", { title: "Anglais : revoir la méthode de khôlle (lundi)", prio: "important" });
  // samedi 5/12 : la synthèse de 3 h remplace l'après-midi
  set("Anglais : méthode de khôlle / oral", SA, "2026-12-05", { deleted: true });
  set("Synthèse EDHEC", SA, "2026-12-05", { deleted: true });
  set("Anki : toutes les cartes dues", SA, "2026-12-05", { start: "17:15", end: "17:45" });
  set("Espagnol : exercices", SA, "2026-12-05", { deleted: true });
  // DS de maths vendredi 4/12 : maths à fond
  set("Gestion : reprendre le cours", JE, "2026-12-03", { title: "Maths : dernier entraînement avant le DS", cat: "maths" });
  set("Anki : toutes les cartes dues", VE, "2026-12-04", { start: "17:30", end: "18:00" });
  return ov;
}

export const GOALS: Goal[] = [
  { id: "g-maths", label: "Maths", cat: "maths", unit: "h", target: 5, period: "semaine" },
  { id: "g-micro", label: "Micro", cat: "micro", unit: "h", target: 3.5, period: "semaine" },
  { id: "g-synth", label: "Synthèse EDHEC", cat: "synthese", unit: "h", target: 2, period: "semaine" },
  { id: "g-anglais", label: "Anglais", cat: "anglais", unit: "h", target: 1.5, period: "semaine" },
  { id: "g-macro", label: "Macro · éco monétaire", cat: "macro", unit: "h", target: 1.5, period: "semaine" },
  { id: "g-gestion", label: "Gestion", cat: "gestion", unit: "h", target: 1, period: "semaine" },
  { id: "g-espagnol", label: "Espagnol", cat: "espagnol", unit: "h", target: 1, period: "semaine" },
  { id: "g-anki", label: "Anki", cat: "anki", unit: "séances", target: 7, period: "semaine" },
  { id: "g-actu", label: "Actu (lecture + révision jeudi)", cat: "actu", unit: "séances", target: 6, period: "semaine" },
  { id: "g-sport", label: "Sport", cat: "sport", unit: "séances", target: 3, period: "semaine" },
  { ...RUN_GOAL },
  { id: "g-lecture", label: "Soirs sans téléphone + lecture", cat: "lecture", unit: "séances", target: 4, period: "semaine" },
];

export function seedPlan(): Plan {
  const template = WEEK_TEMPLATE.map((a) => ({ ...a }));
  return {
    v: 2,
    categories: CATEGORIES.map((c) => ({ ...c })),
    activities: [...template, ...runSeries(), ...DEADLINES, ...TASKS],
    overrides: adjustments(template),
    done: {},
    postponed: [],
    goals: GOALS.map((g) => ({ ...g })),
    reviews: {},
    sleep: {},
    prefs: { ...DEFAULT_PREFS },
    copies: [],
    routines: structuredClone(DEFAULT_ROUTINES),
    routineLog: {},
    run: { log: [] },
  };
}
