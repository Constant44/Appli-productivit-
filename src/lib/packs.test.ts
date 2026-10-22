import { beforeEach, describe, expect, it } from "vitest";
import { applyEmbeddedPacks, useStore } from "./store";

describe("packs embarqués", () => {
  beforeEach(() => useStore.getState().resetAll());

  it("fusionne une seule fois et garde l'avancement des annales", () => {
    useStore.getState().updateEdhec((e) => ({ ...e, annales: e.annales.map((a) => (a.id === "ens2025" ? { ...a, done: true, score: 12 } : a)) }));
    applyEmbeddedPacks();
    const s = useStore.getState();
    const ens2025 = s.edhec.annales.find((a) => a.id === "ens2025")!;
    expect(ens2025).toMatchObject({ done: true, score: 12, kind: "ens" });
    expect(ens2025.links?.length).toBeGreaterThan(0);
    expect(s.edhec.chapters[0].name).toMatch(/Contrainte budgétaire/);
    expect(s.evals.some((e) => e.id === "ds-2026-11-06")).toBe(true);
    expect(s.settings.pomodoroWork).toBe(30);

    useStore.getState().deleteEval("ds-2026-11-06");
    applyEmbeddedPacks(); // déjà fusionné : un DS supprimé ne revient pas
    expect(useStore.getState().evals.some((e) => e.id === "ds-2026-11-06")).toBe(false);
  });
});

describe("import Pronote", () => {
  beforeEach(() => useStore.getState().resetAll());
  it("remplace la note saisie à la main, garde les devoirs cochés, remplace l'emploi du temps manuel", () => {
    applyEmbeddedPacks();
    const st = useStore.getState();
    expect(st.grades.some((g) => g.id === "g-maths-ds2")).toBe(true);
    useStore.setState({ tasks: [...st.tasks, { id: "pn-hw-1", title: "Exos", subject: "Maths", kind: "devoir", estimateMin: 30, priority: 2, done: true, createdAt: "x", source: "pronote" }] });
    useStore.getState().mergePack({
      id: "pronote-test",
      grades: [{ id: "pn-42", subject: "Maths", value: 4.5, outOf: 16, coefficient: 1, date: "2026-10-09T08:00:00+02:00", source: "pronote" }],
      tasks: [{ id: "pn-hw-1", title: "Exos", subject: "Maths", kind: "devoir", estimateMin: 30, priority: 2, done: false, createdAt: "y", source: "pronote" }],
      lessons: [{ id: "pn-l-1", start: "2026-11-03T08:00:00+01:00", end: "2026-11-03T12:00:00+01:00", subject: "Microéconomie", canceled: false, isTest: false, kind: "lesson" }],
      pronoteDays: ["2026-11-01", "2026-11-08"],
    });
    const s = useStore.getState();
    expect(s.grades.some((g) => g.id === "g-maths-ds2")).toBe(false);
    expect(s.grades.some((g) => g.id === "pn-42")).toBe(true);
    expect(s.tasks.find((t) => t.id === "pn-hw-1")?.done).toBe(true);
    expect(s.lessons.some((l) => l.id.startsWith("edt-2026-11-03"))).toBe(false);
    expect(s.lessons.some((l) => l.id.startsWith("edt-2026-11-10"))).toBe(true);
  });
});
