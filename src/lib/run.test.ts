import { describe, expect, it } from "vitest";
import { expand, normalize, type Plan } from "./model";
import { seedPlan } from "./seed";
import {
  LAST, PROGRAM, blocksTotal, completedAt, longestRun, nextSession, positionAt, recordRun, repOf, runSecAt, runTotal, sessionOf, type RunLog,
} from "./run";

const log = (session: number, date: string, completed = true, feel: RunLog["feel"] = 2): RunLog =>
  ({ id: `${date}-${session}`, date, at: `${date}T17:00:00.000Z`, session, completed, feel, runSec: 0, totalSec: 0 });

describe("programme de course", () => {
  it("33 séances : de 8 × 1 min à 30 min sans s'arrêter, la course ne fait que s'allonger", () => {
    expect(LAST).toBe(33);
    expect(PROGRAM[0].label).toBe("8 × (1 min de course + 1 min 30 de marche)");
    expect(runTotal(PROGRAM[0])).toBe(8 * 60);
    expect(PROGRAM[32].label).toBe("30 min de course sans t'arrêter");
    for (let i = 1; i < LAST; i++) expect(longestRun(PROGRAM[i])).toBeGreaterThanOrEqual(longestRun(PROGRAM[i - 1]));
    // chaque séance commence et finit par 5 min de marche
    for (const s of PROGRAM) {
      expect(s.blocks[0]).toEqual({ kind: "warm", sec: 300 });
      expect(s.blocks[s.blocks.length - 1]).toEqual({ kind: "cool", sec: 300 });
    }
  });

  it("le minuteur sait où on en est, combien on a couru, et si la séance est finie", () => {
    const s = sessionOf(1); // 5 min marche, puis 1 min course / 1 min 30 marche × 8
    expect(positionAt(s, 0).block.kind).toBe("warm");
    expect(positionAt(s, 300).block.kind).toBe("run");
    expect(positionAt(s, 330).left).toBe(30);
    expect(positionAt(s, 360).block.kind).toBe("walk");
    expect(repOf(s, positionAt(s, 360).i)).toEqual({ rep: 2, reps: 8 }); // la marche annonce la course suivante
    expect(runSecAt(s, 330)).toBe(30);
    expect(runSecAt(s, 600)).toBe(120 + 0); // 2 courses finies (300→360, 450→510), la 3e commence à 600
    expect(completedAt(s, blocksTotal(s) - 300)).toBe(true); // retour au calme pas obligatoire
    expect(completedAt(s, 500)).toBe(false);
    expect(positionAt(s, blocksTotal(s)).done).toBe(true);
  });

  it("le programme s'adapte : on avance, on refait si c'est trop dur, on recule après une longue pause", () => {
    expect(nextSession({ log: [] }, "2026-11-23").n).toBe(1);
    expect(nextSession({ log: [log(1, "2026-11-23")] }, "2026-11-26").n).toBe(2);
    const hard = nextSession({ log: [log(1, "2026-11-23"), log(2, "2026-11-26", true, 4)] }, "2026-11-28");
    expect(hard.n).toBe(2);
    expect(hard.reason).toMatch(/On refait/);
    expect(nextSession({ log: [log(5, "2026-11-23", false, 3)] }, "2026-11-25").n).toBe(5);
    const pause = nextSession({ log: [log(9, "2026-11-01")] }, "2026-11-23");
    expect(pause.n).toBe(7);
    expect(pause.reason).toMatch(/22 jours/);
    expect(nextSession({ log: [log(33, "2026-11-23")] }, "2026-11-25").n).toBe(33);
    expect(nextSession({ log: [log(3, "2026-11-23")], pick: 1 }, "2026-11-25").n).toBe(1);
  });
});

describe("course dans le planning", () => {
  it("3 sorties par semaine, jamais deux jours de suite, Basic-Fit après la course", () => {
    const p = normalize(seedPlan());
    const week = expand(p, "2026-11-23", "2026-11-29").filter((o) => o.cat === "course");
    expect(week.map((o) => o.date)).toEqual(["2026-11-23", "2026-11-26", "2026-11-28"]);
    const lu = expand(p, "2026-11-23", "2026-11-23");
    const run = lu.find((o) => o.cat === "course")!;
    const gym = lu.find((o) => o.cat === "sport")!;
    expect(gym.start! >= run.end!).toBe(true);
    expect(p.goals.some((g) => g.id === "g-course")).toBe(true);
  });

  it("un ancien planning reçoit la course une seule fois, et Basic-Fit n'est déplacé que si tu n'y as pas touché", () => {
    const s = seedPlan();
    const old = {
      ...s,
      categories: s.categories.filter((c) => c.id !== "course"),
      goals: s.goals.filter((g) => g.id !== "g-course"),
      activities: s.activities.filter((a) => a.cat !== "course").map((a) =>
        a.cat === "sport" && a.start === "16:55" ? { ...a, title: "Sport : Basic-Fit (vélo compris)", start: "16:15", end: "17:15" }
          : a.cat === "sport" && a.start === "16:10" ? { ...a, title: "Sport : Basic-Fit", start: "15:30", end: "16:30", edited: true } : a),
      run: undefined,
    } as unknown as Plan;
    const n = normalize(old);
    expect(n.run).toEqual({ log: [] });
    expect(n.categories.filter((c) => c.id === "course")).toHaveLength(1);
    expect(n.activities.filter((a) => a.cat === "course")).toHaveLength(3);
    expect(n.activities.find((a) => a.cat === "sport" && a.repeat?.days[0] === 0)!.start).toBe("16:55"); // lundi : déplacé
    expect(n.activities.find((a) => a.cat === "sport" && a.repeat?.days[0] === 3)!.start).toBe("15:30"); // jeudi : modifié à la main, intact
    // supprimer une sortie ne la fait pas revenir
    const without = { ...n, activities: n.activities.filter((a) => a.id !== "run-sa") };
    expect(normalize(without).activities.some((a) => a.id === "run-sa")).toBe(false);
  });

  it("enregistrer une sortie valide la séance prévue du jour", () => {
    const p = normalize(seedPlan());
    const r = recordRun(p, { date: "2026-11-23", at: "2026-11-23T16:50:00.000Z", session: 1, completed: true, feel: 2, runSec: 480, totalSec: 1800 });
    expect(r.run.log).toHaveLength(1);
    const occ = expand(r, "2026-11-23", "2026-11-23").find((o) => o.cat === "course")!;
    expect(occ.done?.minutes).toBe(30);
    expect(nextSession(r.run, "2026-11-26").n).toBe(2);
  });
});

describe("montre Garmin", () => {
  it("donne l'exercice à créer, et garde les relevés de la montre", async () => {
    const { garminName, garminSteps, distanceStats } = await import("./run");
    expect(garminName(sessionOf(1))).toBe("Cadence S1");
    expect(garminSteps(sessionOf(1))).toEqual([
      "Échauffement : durée 5:00 (marche rapide)",
      "Répéter 8 fois : Course 1:00 puis Récupération 1:30 (marche)",
      "Retour au calme : durée 5:00 (marche)",
    ]);
    expect(garminName(sessionOf(28))).toBe("Cadence 20 min");
    expect(garminSteps(sessionOf(33))[1]).toBe("Course : durée 30:00");
    const p = normalize(seedPlan());
    const w = { ...p, run: { ...p.run, watch: true } };
    const r = recordRun(w, { date: "2026-11-23", at: "2026-11-23T16:50:00.000Z", session: 1, completed: true, feel: 2, runSec: 480, totalSec: 1710, km: 3.4, hr: 151, source: "garmin" });
    expect(r.run.watch).toBe(true);
    expect(distanceStats(r.run)).toEqual({ km: 3.4, count: 1 });
  });
});
