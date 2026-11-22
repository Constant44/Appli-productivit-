import { describe, expect, it } from "vitest";
import { buildProgram, mergeProgram } from "./program";
import type { EdhecState, Evaluation } from "./types";

const edhec: EdhecState = { chapters: [{ id: "ch1", name: "Préférences", level: 0 }], annales: [], syntheses: [], english: [] };
const ds: Evaluation = { id: "ds1", type: "DS", subject: "Microéconomie", date: "2026-11-06T13:00:00+01:00", durationMin: 240, source: "manual" };

describe("programme quotidien", () => {
  const today = new Date("2026-10-27T09:00:00+01:00");
  const prog = buildProgram({ today, evals: [ds], tasks: [], edhec, dailyGoalMin: 240 });

  it("prépare le DS sur les jours précédents, sans dépasser la capacité", () => {
    const prep = prog.filter((t) => t.program === "ev-ds1");
    expect(prep.reduce((a, t) => a + t.estimateMin, 0)).toBe(420);
    expect(prep.every((t) => t.plannedFor! < "2026-11-06" && t.plannedFor! >= "2026-10-29")).toBe(true);
    const perDay = new Map<string, number>();
    for (const t of prog) perDay.set(t.plannedFor!, (perDay.get(t.plannedFor!) ?? 0) + t.estimateMin);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(240);
  });

  it("déduit le travail fait et reste stable si rien ne change", () => {
    const done = { ...prog.find((t) => t.program === "ev-ds1")!, done: true };
    const again = buildProgram({ today, evals: [ds], tasks: [done], edhec, dailyGoalMin: 240 });
    expect(again.filter((t) => t.program === "ev-ds1").reduce((a, t) => a + t.estimateMin, 0)).toBe(420 - done.estimateMin);
    expect(mergeProgram(prog, buildProgram({ today, evals: [ds], tasks: prog, edhec, dailyGoalMin: 240 }))).toBeNull();
    const merged = mergeProgram([done], again)!;
    expect(new Set(merged.map((t) => t.id)).size).toBe(merged.length);
  });
});
