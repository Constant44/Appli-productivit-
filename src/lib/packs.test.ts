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
