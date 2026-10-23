export type ID = string;

export type TaskKind = "devoir" | "revision" | "exercices" | "fiche" | "perso";
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  devoir: "Devoir",
  revision: "Révision",
  exercices: "Exercices",
  fiche: "Fiche",
  perso: "Perso",
};

export type Task = {
  id: ID;
  title: string;
  subject: string;
  kind: TaskKind;
  /** ISO date (jour) */
  due?: string;
  /** Estimation de l'utilisateur, en minutes */
  estimateMin: number;
  /** Temps réel saisi manuellement (minutes). Si absent, on prend la somme des sessions. */
  actualMinManual?: number;
  priority: 1 | 2 | 3;
  done: boolean;
  doneAt?: string;
  createdAt: string;
  planId?: ID;
  evalId?: ID;
  source: "manual" | "pronote";
  pronoteId?: string;
  notes?: string;
  /** Récompense déjà versée (évite les doubles gains) */
  rewarded?: boolean;
  /** Programme quotidien : jour prévu (ISO) et clé du besoin couvert */
  plannedFor?: string;
  program?: string;
  /** Écran de l'appli où faire ce travail (programme quotidien) */
  link?: string;
};

export type EvalType = "DS" | "Khôlle" | "DM" | "Concours blanc" | "Interro" | "Oral";
export const EVAL_TYPES: EvalType[] = ["DS", "Khôlle", "DM", "Concours blanc", "Interro", "Oral"];

export type Evaluation = {
  id: ID;
  type: EvalType;
  subject: string;
  /** ISO datetime */
  date: string;
  durationMin?: number;
  topic?: string;
  /** Piste trouvée dans les mails / le Drive, en attendant le programme confirmé */
  hint?: string;
  examiner?: string;
  room?: string;
  /** Note obtenue /20 une fois connue */
  result?: number;
  source: "manual" | "pronote";
  pronoteId?: string;
  rewarded?: boolean;
  debrief?: Debrief;
};

/** Retour sur un DS / une khôlle : ce qui a marché, ce qui a coûté des points, et quoi changer. */
export type Debrief = {
  at: string;
  feeling: 1 | 2 | 3 | 4 | 5;
  good: string;
  /** Chaque erreur devient une carte du carnet d'erreurs */
  errors: Array<{ q: string; a: string }>;
  /** Cause principale des points perdus */
  cause: "cours" | "methode" | "temps" | "inattention" | "stress";
  nextTime: string;
};

export type Session = {
  id: ID;
  taskId?: ID;
  subject?: string;
  start: string;
  minutes: number;
  /** Qualité de concentration ressentie 1-5 */
  focus?: number;
  xp: number;
  coins: number;
  note?: string;
};

export type Plan = {
  id: ID;
  name: string;
  start: string;
  end: string;
  /** minutes de travail disponibles par jour */
  dailyMin: number;
  /** jours off (0 = dimanche) */
  daysOff: number[];
};

export type Grade = {
  id: ID;
  subject: string;
  value: number;
  outOf: number;
  coefficient: number;
  date: string;
  label?: string;
  classAverage?: number | null;
  source: "manual" | "pronote";
  period?: string;
};

export type Lesson = {
  id: string;
  start: string;
  end: string;
  subject: string;
  title?: string;
  teacher?: string;
  room?: string;
  canceled: boolean;
  isTest: boolean;
  status?: string;
  color?: string;
  kind: "lesson" | "activity" | "detention";
};

export type CustomEvent = {
  id: ID;
  title: string;
  /** 0 = lundi ... 6 = dimanche */
  weekday: number;
  startTime: string; // "08:00"
  endTime: string;
  color: string;
};

// ---------------- Football ----------------

export type Position = "GB" | "DEF" | "MIL" | "ATT";
export const POSITIONS: Position[] = ["GB", "DEF", "MIL", "ATT"];
/** 4-3-3 */
export const FORMATION: Record<Position, number> = { GB: 1, DEF: 4, MIL: 3, ATT: 3 };

export type Player = {
  id: ID;
  name: string;
  nationality: string;
  pos: Position;
  age: number;
  ovr: number;
  pot: number;
  /** progression partielle accumulée vers le prochain point de note */
  xpTrain: number;
  goals: number;
  apps: number;
  fromAcademy?: boolean;
};

export type FacilityKey = "training" | "academy" | "scouting" | "stadium" | "staff";

export type LeagueTeam = {
  id: ID;
  name: string;
  strength: number;
  isUser?: boolean;
};

export type Fixture = { home: ID; away: ID; hg?: number; ag?: number; scorers?: string[] };

export type Season = {
  number: number;
  division: number; // 0 = élite, plus grand = plus bas
  teams: LeagueTeam[];
  /** journées → matchs */
  rounds: Fixture[][];
  currentRound: number;
};

export type Trophy = { season: number; label: string };

export type Club = {
  name: string;
  colorA: string;
  colorB: string;
  players: Player[];
  facilities: Record<FacilityKey, number>;
  market: Player[];
  marketRefreshedAt: number; // minutes de travail cumulées au dernier refresh
  academyLastAt: number; // minutes cumulées au dernier jeune promu
  season: Season;
  trophies: Trophy[];
  /** Minutes de travail "en banque" pour débloquer les matchs */
  matchMinutesBank: number;
  history: Array<{ season: number; division: number; rank: number }>;
};

export type PronoteConfig = {
  url: string;
  username: string;
  token?: string;
  deviceUUID: string;
  lastSync?: string;
  user?: { name: string; className?: string; establishment?: string };
  warnings?: string[];
};

export type Toast = { id: ID; title: string; body?: string; tone?: "good" | "info" | "warn" | "gold" };

// ---------------- Révisions (Vendredi, EDHEC) ----------------

export type Deck = "mot" | "bio" | "actu" | "anglais" | "micro" | "erreur";
export const DECK_LABEL: Record<Deck, string> = { mot: "Mots", bio: "Personnages", actu: "Actu", anglais: "Anglais", micro: "Micro", erreur: "Carnet d'erreurs" };

/** Fiche source (mot ou personnage envoyé par le prof). */
export type Sheet = { id: string; kind: "mot" | "bio"; title: string; body: string; sentAt: string };

export type Card = { id: string; deck: Deck; front: string; back: string; ref?: string; date?: string };

export type ActuDay = { id: string; title: string };

export type AnnaleKind = "ens" | "edhec-micro" | "anglais" | "synthese";
export const ANNALE_KIND_LABEL: Record<AnnaleKind, string> = {
  ens: "ENS D2 · micro (AEG)",
  "edhec-micro": "EDHEC Pré-Master · micro",
  anglais: "EDHEC Pré-Master · anglais",
  synthese: "EDHEC Pré-Master · synthèse",
};
export type Annale = {
  id: string;
  label: string;
  done: boolean;
  score?: number;
  kind?: AnnaleKind;
  year?: number;
  /** Liens vers le sujet / les corrigés (Drive ou web) */
  links?: Array<{ label: string; url: string }>;
};

/**
 * Pack de contenu (graine embarquée, import de données, ou déposé dans la boîte de réception par la tâche automatique).
 * Chaque pack n'est fusionné qu'une fois (identifiant gardé dans `inboxDone`).
 */
export type ContentPack = {
  id: string;
  sheets?: Sheet[];
  cards?: Card[];
  actuDays?: ActuDay[];
  tasks?: Task[];
  evals?: Evaluation[];
  grades?: Grade[];
  lessons?: Lesson[];
  cgTests?: CgTest[];
  /** Fiches déjà tombées au test du vendredi */
  fallen?: string[];
  /** Fiches à remettre en révision (marquées tombées par erreur) */
  unfallen?: string[];
  /** Annales à ajouter ou compléter (liens) — l'avancement (fait, note) déjà saisi est conservé. */
  annales?: Annale[];
  /** Renomme les chapitres de micro (le niveau de maîtrise est conservé par identifiant). */
  chapters?: Array<{ id: string; name: string }>;
  /** Import Pronote : jours couverts par l'emploi du temps importé (remplace les cours saisis à la main sur cette période) */
  pronoteDays?: [string, string];
  /** Pistes de programme pour des DS / khôlles existants (n'écrase jamais le programme saisi) */
  evalHints?: Record<string, string>;
  settings?: { pomodoroWork?: number; pomodoroBreak?: number; dailyGoalMin?: number; addSubjects?: string[]; subjectCoefs?: Record<string, number> };
};

export type CgTest = { id: string; date: string; score: number; outOf: number; note?: string };

export type EdhecState = {
  chapters: Array<{ id: string; name: string; level: 0 | 1 | 2 | 3 }>;
  annales: Annale[];
  syntheses: Array<{ id: string; date: string; theme: string; note?: number; words?: number; minutes?: number; feedback?: string }>;
  english: Array<{ date: string; score: number; total: number; mode?: "blanc"; minutes?: number; byTheme?: Record<string, [number, number]> }>;
  /** Thème-version de Mme Terroni : dernière note /2 par phrase */
  tv?: Record<string, { score: number; date: string; n: number }>;
};
