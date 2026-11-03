import { describe, expect, it } from "vitest";
import { buildMatchSheet } from "./matchday";
import type { Lesson, Session, Task } from "./types";

const task = (id: string, estimateMin: number): Task => ({
  id, title: id, subject: "Maths", kind: "devoir", estimateMin, priority: 2, done: false, createdAt: "2026-11-01", source: "manual",
});
const lesson = (start: string, end: string): Lesson => ({ id: start, start, end, subject: "Maths", canceled: false, isTest: false, kind: "lesson" });

describe("feuille de match", () => {
  // Mardi 3/11/2026 : cours 8h-12h puis 13h-17h → travail possible de 17h à la fermeture de la BU (21h)
  const base = { lessons: [lesson("2026-11-03T08:00:00", "2026-11-03T12:00:00"), lesson("2026-11-03T13:00:00", "2026-11-03T17:00:00")], evals: [], work: 30, pause: 5 };

  it("place l'échauffement puis des pomodoros dans les trous, sans chevaucher les cours", () => {
    const sh = buildMatchSheet({ ...base, now: new Date("2026-11-03T07:00:00"), tasks: [task("a", 60), task("b", 60)], sessions: [], warmupDone: false });
    const work = sh.blocks.filter((b) => b.kind !== "busy");
    expect(work[0].kind).toBe("warmup");
    expect(work[0].start.getHours()).toBe(17);
    for (const b of work) expect(b.start.getHours() >= 17 && +b.end <= +new Date("2026-11-03T21:00:00")).toBe(true);
    expect(work.slice(1, 5).map((b) => b.taskId)).toEqual(["a", "a", "b", "b"]);
    expect(sh.current?.status).toBe("next");
  });

  it("marque les créneaux joués, manqués et le retard", () => {
    const tasks = [task("a", 120)];
    const free = { ...base, lessons: [] };
    // Mercredi 4/11 : arrivée 9h. Échauffement 9h-9h15, a: 9h20-9h50, 9h55-10h25…
    const sessions: Session[] = [{ id: "s", start: "2026-11-04T09:20:00", minutes: 30, xp: 0, coins: 0, taskId: "a" }];
    const sh = buildMatchSheet({ ...free, now: new Date("2026-11-04T10:40:00"), tasks, sessions, warmupDone: true });
    const [w, b1, b2, b3] = sh.blocks;
    expect([w.status, b1.status, b2.status, b3.status]).toEqual(["done", "done", "missed", "now"]);
    expect(sh.lateMin).toBe(10);
    expect(sh.playedMin).toBe(30);
  });

  it("ne prévoit pas plus que l'objectif du jour", () => {
    const sh = buildMatchSheet({ ...base, lessons: [], now: new Date("2026-11-04T07:00:00"), tasks: [task("a", 600)], sessions: [], warmupDone: false, goalMin: 120 });
    expect(sh.plannedMin).toBe(120);
  });
});

import { countWords } from "./utils";
describe("décompte de mots EDHEC", () => {
  it("compte l'élision à part, garde les mots composés et ignore la ponctuation", () => {
    expect(countWords("L'État et le porte-parole de l'UE — ont parlé.")).toBe(10);
  });
});

import { subjectAverages } from "./insights";
import coefPack from "../data/packs/2026-10-coefs.json";
describe("moyennes comme Pronote", () => {
  it("retrouve les moyennes du bulletin de Constant (moyenne générale 8,91)", () => {
    const r = subjectAverages(coefPack.grades as never, coefPack.settings.subjectCoefs);
    const avg = (s: string) => r.bySubject.find((x) => x.subject === s)!.avg.toFixed(2);
    expect([avg("Maths"), avg("Macroéconomie"), avg("Anglais"), avg("Approf. méthodo")]).toEqual(["7.81", "7.40", "11.50", "11.39"]);
    expect(r.overall.toFixed(2)).toBe("8.91");
  });
});

import { neededGrade, subjectAverages as avgs } from "./insights";
describe("objectif de moyenne", () => {
  it("la note calculée donne exactement la moyenne visée", () => {
    const g = [
      { id: "a", subject: "Maths", value: 8, outOf: 16, coefficient: 1, date: "2026-09-11", source: "pronote" as const },
      { id: "b", subject: "Macroéconomie", value: 11, outOf: 20, coefficient: 1, date: "2026-09-17", source: "pronote" as const },
      { id: "c", subject: "Anglais", value: 11.5, outOf: 20, coefficient: 1, date: "2026-09-15", source: "pronote" as const },
    ];
    const { x } = neededGrade(g, "Maths", 11);
    expect(x).toBeGreaterThan(0);
    const after = avgs([...g, { id: "s", subject: "Maths", value: x, outOf: 20, coefficient: 1, date: "", source: "manual" }]).overall;
    expect(after).toBeCloseTo(11, 6);
  });
});
