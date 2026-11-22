import { describe, expect, it } from "vitest";
import {
  applyTraining, bestEleven, generateMarket, initialClub, levelFromXp, playRound, roundRobin,
  sessionRewards, standings, taskCompletionBonus, teamStrength, xpToNext,
} from "./game";
import { buildSchedule, calibrationData, correctedEstimate, currentStreak, recommend } from "./insights";
import type { Plan, Session, Task } from "./types";
import { addDays, isoDay } from "./utils";

const task = (p: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2), title: "t", subject: "Maths", kind: "devoir", estimateMin: 60,
  priority: 2, done: false, createdAt: new Date().toISOString(), source: "manual", ...p,
});

describe("niveaux", () => {
  it("niveau 1→2 en 600 XP, cumul cohérent", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 600 });
    expect(levelFromXp(599).level).toBe(1);
    expect(levelFromXp(600).level).toBe(2);
    expect(levelFromXp(600 + xpToNext(2)).level).toBe(3);
  });
  it("gains proportionnels aux minutes et multipliés par la série", () => {
    const a = sessionRewards(60, { streak: 0, staffLevel: 0 });
    const b = sessionRewards(60, { streak: 10, staffLevel: 0 });
    expect(a.xp).toBe(600);
    expect(b.xp).toBe(900);
  });
});

describe("calibration des estimations", () => {
  it("moyenne géométrique : ×2 et ×0.5 se compensent", () => {
    const tasks = [
      task({ done: true, estimateMin: 60, actualMinManual: 120 }),
      task({ done: true, estimateMin: 60, actualMinManual: 30 }),
    ];
    expect(calibrationData(tasks, []).global.factor).toBeCloseTo(1, 6);
  });
  it("corrige avec le facteur de la matière dès 3 points", () => {
    const tasks = [1, 2, 3].map(() => task({ done: true, estimateMin: 60, actualMinManual: 90 }));
    const cal = calibrationData(tasks, []);
    expect(correctedEstimate(40, "Maths", cal).value).toBeCloseTo(60, 6);
    expect(correctedEstimate(40, "Droit", cal).basis).toBe("global");
  });
  it("bonus précision à ±15 %", () => {
    expect(taskCompletionBonus(60, 65).label).toMatch(/chirurgicale/);
    expect(taskCompletionBonus(60, 100).label).toBe("Tâche terminée");
  });
});

describe("séries", () => {
  it("compte les jours consécutifs ≥ 25 min, vivante si aujourd'hui pas encore fait", () => {
    const now = new Date();
    const mk = (d: number, m: number): Session => ({ id: String(d), start: addDays(now, -d).toISOString(), minutes: m, xp: 0, coins: 0 });
    expect(currentStreak([mk(1, 30), mk(2, 40), mk(3, 10)], now)).toBe(2);
    expect(currentStreak([mk(0, 30), mk(1, 30)], now)).toBe(2);
  });
});

describe("planificateur", () => {
  it("respecte la capacité quotidienne et signale le surplus", () => {
    const plan: Plan = { id: "p", name: "x", start: isoDay(new Date()), end: isoDay(addDays(new Date(), 1)), dailyMin: 60, daysOff: [] };
    const tasks = [task({ planId: "p", estimateMin: 50 }), task({ planId: "p", estimateMin: 100 })];
    const s = buildSchedule(plan, tasks, [], calibrationData([], []));
    for (const d of s.days) expect(d.load).toBeLessThanOrEqual(60);
    expect(s.capacity).toBe(120);
    // jour 1 : 50 min ; les 10 min restantes ne suffisent pas pour un bloc (≥ 20 min)
    // jour 2 : 60 min de la tâche de 100 → 40 min non planifiées
    expect(s.unscheduled.reduce((a, b) => a + b.minutes, 0)).toBe(40);
  });
});

describe("recommandations", () => {
  it("met le devoir en retard en premier", () => {
    const late = task({ title: "late", due: isoDay(addDays(new Date(), -1)) });
    const later = task({ title: "later", due: isoDay(addDays(new Date(), 10)) });
    expect(recommend([later, late], [], [])[0].task.title).toBe("late");
  });
});

describe("football", () => {
  it("round-robin aller-retour : chaque équipe joue 18 matchs à 10", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const rounds = roundRobin(ids);
    expect(rounds).toHaveLength(18);
    for (const id of ids) expect(rounds.flat().filter((f) => f.home === id || f.away === id)).toHaveLength(18);
  });
  it("le club initial a un XI complet et joue une journée", () => {
    const club = initialClub();
    const xi = bestEleven(club.players);
    expect(xi.GB).toHaveLength(1);
    expect(xi.DEF).toHaveLength(4);
    const { season, userFixture } = playRound(club);
    expect(season.currentRound).toBe(1);
    expect(userFixture?.hg).toBeTypeOf("number");
    expect(standings(season).reduce((a, r) => a + r.p, 0)).toBe(10);
  });
  it("l'entraînement fait progresser sans dépasser le potentiel", () => {
    const club = initialClub();
    const { players } = applyTraining(club.players, 200, 5);
    for (const p of players) expect(p.ovr).toBeLessThanOrEqual(p.pot);
    expect(teamStrength(players)).toBeGreaterThan(teamStrength(club.players));
  });
  it("le mercato contient tous les postes", () => {
    const m = generateMarket(0, 1);
    for (const pos of ["GB", "DEF", "MIL", "ATT"]) expect(m.some((p) => p.pos === pos)).toBe(true);
  });
});
