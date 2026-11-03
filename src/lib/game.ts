/**
 * Moteur de jeu : économie (XP, budget), joueurs, infrastructures, matchs, saisons.
 * Toutes les fonctions sont pures (pas d'accès au store) pour être testables.
 */
import type { Club, FacilityKey, Fixture, LeagueTeam, Player, Position, Season } from "./types";
import { FORMATION } from "./types";
import { clamp, pick, rng, uid } from "./utils";

// ================= Progression du joueur (toi) =================

/** XP nécessaire pour passer du niveau L à L+1. Niveau 1→2 = 1 h de travail. */
export const xpToNext = (level: number) => 600 + 150 * (level - 1);

export function levelFromXp(totalXp: number) {
  let level = 1;
  let rest = totalXp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level) };
}

export const LEVEL_TITLES = [
  "Bizut",
  "Carré motivé",
  "Taupin régulier",
  "Khôlleur redouté",
  "Major de colle",
  "Admissible",
  "Machine à fiches",
  "Normalien en devenir",
  "Légende de la prépa",
];
export const levelTitle = (level: number) =>
  LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))];

/** Multiplicateur de série : +5 % par jour consécutif, plafonné à +50 %. */
export const streakMultiplier = (streak: number) => 1 + Math.min(streak, 10) * 0.05;

/** Multiplicateur de concentration (auto-évaluée 1-5). */
export const focusMultiplier = (focus?: number) => (focus ? 0.8 + (focus - 1) * 0.1 : 1);

export const sponsorMultiplier = (staffLevel: number) => 1 + 0.08 * staffLevel;

/** Gains d'une session de travail. */
export function sessionRewards(minutes: number, opts: { streak: number; focus?: number; staffLevel: number }) {
  const m = Math.max(0, minutes);
  const sm = streakMultiplier(opts.streak);
  const fm = focusMultiplier(opts.focus);
  const xp = Math.round(m * 10 * sm * fm);
  const coins = Math.round(m * 10 * sm * fm * sponsorMultiplier(opts.staffLevel)); // k€
  return { xp, coins };
}

/** Bonus quand une tâche est terminée, selon la précision de l'estimation. */
export function taskCompletionBonus(estimateMin: number, actualMin: number | null) {
  let xp = 30;
  let coins = 40;
  let label = "Tâche terminée";
  if (actualMin && estimateMin > 0) {
    const err = Math.abs(actualMin / estimateMin - 1);
    if (err <= 0.15) {
      xp += 120;
      coins += 120;
      label = "Estimation chirurgicale (±15 %)";
    } else if (err <= 0.3) {
      xp += 50;
      coins += 50;
      label = "Bonne estimation (±30 %)";
    }
  }
  return { xp, coins, label };
}

/** Prime de résultat pour un DS/khôlle (note /20). */
export function resultBonus(note: number, type: string) {
  const weight = type === "DS" || type === "Concours blanc" ? 2 : 1;
  const coins = Math.max(0, Math.round((note - 8) * 60 * weight));
  const xp = Math.max(0, Math.round((note - 8) * 25 * weight));
  return { coins, xp };
}

export const MATCH_COST_MIN = 90;

// ================= Infrastructures =================

export const FACILITIES: Record<
  FacilityKey,
  { label: string; icon: string; base: number; desc: (lvl: number) => string }
> = {
  training: {
    label: "Centre d'entraînement",
    icon: "🏋️",
    base: 800,
    desc: (l) => `Tes joueurs progressent pendant que tu bosses : ${trainingRate(l).toFixed(2)} pt/h de travail (vers leur potentiel).`,
  },
  academy: {
    label: "Centre de formation",
    icon: "🌱",
    base: 1500,
    desc: (l) =>
      l === 0
        ? "Fermé. Ouvre-le pour sortir des jeunes à fort potentiel."
        : `Un jeune toutes les ${academyEveryHours(l)} h de travail, potentiel ~${60 + 6 * l}.`,
  },
  scouting: {
    label: "Réseau de recruteurs",
    icon: "🔭",
    base: 600,
    desc: (l) => {
      const [a, b] = marketRange(l);
      return `Mercato : ${marketSize(l)} joueurs, notes ${a}–${b}. Renouvelé toutes les 3 h de travail.`;
    },
  },
  stadium: {
    label: "Stade",
    icon: "🏟️",
    base: 1200,
    desc: (l) => `Avantage à domicile +${(2 + 0.8 * l).toFixed(1)}, recette par victoire ${matchIncome(l)} k€.`,
  },
  staff: {
    label: "Sponsors & staff",
    icon: "🤝",
    base: 1000,
    desc: (l) => `+${Math.round(8 * l)} % de budget gagné par minute de travail.`,
  },
};

export const MAX_FACILITY = 5;
export const facilityCost = (key: FacilityKey, level: number) =>
  Math.round(FACILITIES[key].base * Math.pow(2.2, level));

export const trainingRate = (l: number) => 0.25 + 0.2 * l;
export const academyEveryHours = (l: number) => Math.max(3, 12 - 2 * l);
export const marketRange = (l: number): [number, number] => [46 + 4 * l, 64 + 5 * l];
export const marketSize = (l: number) => 6 + 2 * l;
export const matchIncome = (l: number) => 60 + 40 * l;

// ================= Joueurs =================

const FIRST = [
  "Lucas", "Mathis", "Yanis", "Noah", "Enzo", "Hugo", "Théo", "Nathan", "Rayan", "Adam", "Kylian", "Mehdi",
  "Ousmane", "Ibrahim", "Moussa", "Joao", "Diego", "Mateo", "Luka", "Marco", "Kai", "Jonas", "Lars", "Sven",
  "Pablo", "Iker", "Sergio", "Federico", "Andrea", "Kenji", "Tiago", "Bruno", "Rafael", "Emil", "Arda",
  "Achraf", "Sofiane", "Bilal", "Wout", "Jérémy", "Florian", "Alexis", "Maxence", "Ilyes", "Samuel",
];
const LAST = [
  "Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Diallo", "Traoré", "Koné", "Mendes", "Silva",
  "Costa", "Rossi", "Bianchi", "Müller", "Schmidt", "Fischer", "Jansen", "De Jong", "García", "López",
  "Fernández", "Novak", "Kovač", "Yilmaz", "Benali", "Haddad", "Okafor", "Mensah", "Nakamura", "Petrov",
  "Lindqvist", "Andersen", "Ferreira", "Camara", "Sow", "Girard", "Roux", "Fontaine", "Lefèvre", "Mbappé-ish",
];
const NATS = ["🇫🇷", "🇫🇷", "🇫🇷", "🇧🇪", "🇪🇸", "🇵🇹", "🇧🇷", "🇦🇷", "🇩🇪", "🇮🇹", "🇳🇱", "🇸🇳", "🇨🇮", "🇲🇦", "🇩🇿", "🇯🇵", "🇭🇷", "🇳🇴"];

export function makePlayer(
  opts: { ovr: number; pot?: number; age?: number; pos?: Position; fromAcademy?: boolean },
  r: () => number = Math.random,
): Player {
  const pos: Position = opts.pos ?? pick<Position>(["GB", "DEF", "DEF", "DEF", "MIL", "MIL", "MIL", "ATT", "ATT"], r);
  const age = opts.age ?? Math.floor(18 + r() * 15);
  const ovr = clamp(Math.round(opts.ovr), 35, 95);
  const youthRoom = age <= 21 ? 6 + r() * 16 : age <= 25 ? 2 + r() * 9 : age <= 29 ? r() * 3 : 0;
  const pot = clamp(Math.round(opts.pot ?? ovr + youthRoom), ovr, 96);
  return {
    id: uid(),
    name: `${pick(FIRST, r)} ${pick(LAST, r).replace("-ish", "")}`,
    nationality: pick(NATS, r),
    pos,
    age,
    ovr,
    pot,
    xpTrain: 0,
    goals: 0,
    apps: 0,
    fromAcademy: opts.fromAcademy,
  };
}

/** Valeur marchande en k€ */
export function playerValue(p: Pick<Player, "ovr" | "pot" | "age">) {
  const ageF = p.age <= 21 ? 1.3 : p.age <= 28 ? 1 : p.age <= 31 ? 0.75 : 0.5;
  const potF = 1 + Math.max(0, p.pot - p.ovr) * 0.03;
  return Math.round(300 * Math.pow(1.13, p.ovr - 50) * ageF * potF);
}
export const sellPrice = (p: Player) => Math.round(playerValue(p) * 0.7);

export function generateMarket(scoutingLevel: number, seed = Date.now()): Player[] {
  const r = rng(seed);
  const [lo, hi] = marketRange(scoutingLevel);
  const n = marketSize(scoutingLevel);
  const out: Player[] = [];
  for (let i = 0; i < n; i++) {
    // biais vers le bas de la fourchette : les pépites sont rares
    const t = Math.pow(r(), 1.6);
    out.push(makePlayer({ ovr: lo + t * (hi - lo) }, r));
  }
  // garantir au moins un joueur par poste
  const missing = (["GB", "DEF", "MIL", "ATT"] as Position[]).filter((p) => !out.some((x) => x.pos === p));
  for (const pos of missing) out.push(makePlayer({ ovr: lo + r() * (hi - lo) * 0.6, pos }, r));
  return out.sort((a, b) => b.ovr - a.ovr);
}

export function academyProspect(level: number): Player {
  const r = Math.random;
  const pot = clamp(Math.round(58 + 6 * level + (r() - 0.5) * 12), 55, 94);
  return makePlayer({ ovr: 42 + level * 2 + r() * 6, pot, age: 16 + Math.floor(r() * 3), fromAcademy: true }, r);
}

/**
 * Entraînement : appliqué à chaque session, proportionnellement aux heures travaillées.
 * Retourne les joueurs mis à jour + la liste des progressions (pour les notifications).
 */
export function applyTraining(players: Player[], hours: number, trainingLevel: number) {
  const ups: string[] = [];
  const rate = trainingRate(trainingLevel);
  const next = players.map((p) => {
    if (p.ovr >= p.pot) return p;
    const ageF = p.age <= 21 ? 1.5 : p.age <= 25 ? 1.1 : p.age <= 29 ? 0.7 : 0.35;
    let xpTrain = p.xpTrain + hours * rate * ageF;
    let ovr = p.ovr;
    while (xpTrain >= 1 && ovr < p.pot) {
      xpTrain -= 1;
      ovr++;
    }
    if (ovr > p.ovr) ups.push(`${p.name} ${p.ovr}→${ovr}`);
    return { ...p, ovr, xpTrain: ovr >= p.pot ? 0 : xpTrain };
  });
  return { players: next, ups };
}

// ================= Composition =================

/** Meilleur onze en 4-3-3 (les postes vides comptent comme un joueur noté 30). */
export function bestEleven(players: Player[]) {
  const xi: Record<Position, Player[]> = { GB: [], DEF: [], MIL: [], ATT: [] };
  for (const pos of Object.keys(FORMATION) as Position[]) {
    xi[pos] = players
      .filter((p) => p.pos === pos)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, FORMATION[pos]);
  }
  return xi;
}

export function teamStrength(players: Player[]) {
  const xi = bestEleven(players);
  let sum = 0;
  for (const pos of Object.keys(FORMATION) as Position[]) {
    const list = xi[pos];
    for (let i = 0; i < FORMATION[pos]; i++) sum += list[i]?.ovr ?? 30;
  }
  return sum / 11;
}

// ================= Ligue =================

export const DIVISIONS = ["Ligue des Grandes Écoles", "Ligue 1 Prépa", "Ligue 2 Prépa", "National Bizuth"];
const AI_NAMES = [
  "Olympique Walras", "AS Keynes", "Real Pareto", "FC Hayek", "Sporting Schumpeter", "Inter Ricardo",
  "Dynamo Smith", "Racing Coase", "Stade Friedman", "Athletic Marshall", "Union Nash", "SC Arrow-Debreu",
  "FC Tirole", "Red Star Piketty", "AC Malinvaud", "Borussia Solow", "US Condorcet", "Celtic Ostrom",
];
export const divisionBase = (div: number) => 76 - div * 8; // 76, 68, 60, 52

export function roundRobin(ids: string[]): Fixture[][] {
  const teams = [...ids];
  if (teams.length % 2) teams.push("BYE");
  const n = teams.length;
  const rounds: Fixture[][] = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "BYE" || b === "BYE") continue;
      round.push(r % 2 ? { home: b, away: a } : { home: a, away: b });
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const back = rounds.map((rd) => rd.map((f) => ({ home: f.away, away: f.home })));
  return [...rounds, ...back];
}

export function newSeason(number: number, division: number, userName: string): Season {
  const r = rng(number * 7919 + division * 31 + 17);
  const names = [...AI_NAMES].sort(() => r() - 0.5).slice(0, 9);
  const base = divisionBase(division);
  const teams: LeagueTeam[] = [
    { id: "user", name: userName, strength: 0, isUser: true },
    ...names.map((name, i) => ({
      id: `ai${i}`,
      name,
      strength: Math.round((base + (r() - 0.5) * 10 + (i < 2 ? 2 : 0)) * 10) / 10,
    })),
  ];
  return { number, division, teams, rounds: roundRobin(teams.map((t) => t.id)), currentRound: 0 };
}

function poisson(lambda: number, r: () => number = Math.random) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

export function simulateScore(home: number, away: number, homeAdv: number, r: () => number = Math.random) {
  const diff = home + homeAdv - away;
  const lh = clamp(1.35 * Math.exp(diff / 11), 0.15, 5);
  const la = clamp(1.15 * Math.exp(-diff / 11), 0.15, 5);
  return [poisson(lh, r), poisson(la, r)] as const;
}

export type TableRow = { id: string; name: string; isUser?: boolean; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };

export function standings(season: Season): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const t of season.teams)
    rows.set(t.id, { id: t.id, name: t.name, isUser: t.isUser, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  for (const round of season.rounds)
    for (const f of round) {
      if (f.hg === undefined || f.ag === undefined) continue;
      const h = rows.get(f.home)!;
      const a = rows.get(f.away)!;
      h.p++; a.p++;
      h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
      if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; }
      else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

/** Joue la journée courante. Retourne la saison mise à jour + le match de l'utilisateur. */
export function playRound(club: Club) {
  const season = structuredClone(club.season);
  const strength = teamStrength(club.players);
  const homeAdv = 2 + 0.8 * club.facilities.stadium;
  const str = (id: string) => (id === "user" ? strength : season.teams.find((t) => t.id === id)!.strength);
  const round = season.rounds[season.currentRound];
  let userFixture: Fixture | undefined;
  const xi = bestEleven(club.players);
  const attackers = [...xi.ATT, ...xi.ATT, ...xi.ATT, ...xi.MIL, ...xi.MIL, ...xi.DEF];
  for (const f of round) {
    const [hg, ag] = simulateScore(str(f.home), str(f.away), f.home === "user" ? homeAdv : 2);
    f.hg = hg;
    f.ag = ag;
    if (f.home === "user" || f.away === "user") {
      const ours = f.home === "user" ? hg : ag;
      f.scorers = Array.from({ length: ours }, () => (attackers.length ? pick(attackers).id : ""));
      userFixture = f;
    }
  }
  season.currentRound++;
  return { season, userFixture };
}

export const seasonOver = (s: Season) => s.currentRound >= s.rounds.length;

export function seasonPrize(rank: number, division: number) {
  return Math.round((11 - rank) * 120 * (DIVISIONS.length - division));
}

export function initialClub(name = "Prépa FC"): Club {
  const r = rng(42);
  const players: Player[] = [];
  const plan: [Position, number][] = [["GB", 2], ["DEF", 6], ["MIL", 5], ["ATT", 4]];
  for (const [pos, n] of plan) for (let i = 0; i < n; i++) players.push(makePlayer({ ovr: 45 + r() * 9, pos }, r));
  return {
    name,
    colorA: "#22c55e",
    colorB: "#0f172a",
    players,
    facilities: { training: 0, academy: 0, scouting: 0, stadium: 0, staff: 0 },
    market: generateMarket(0, 1234),
    marketRefreshedAt: 0,
    academyLastAt: 0,
    season: newSeason(1, DIVISIONS.length - 1, name),
    trophies: [],
    matchMinutesBank: 0,
    history: [],
  };
}
