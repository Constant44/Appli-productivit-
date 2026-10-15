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
  examiner?: string;
  room?: string;
  /** Note obtenue /20 une fois connue */
  result?: number;
  source: "manual" | "pronote";
  pronoteId?: string;
  rewarded?: boolean;
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
