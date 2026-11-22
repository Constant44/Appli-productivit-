import { describe, expect, it } from "vitest";
import { expand, normalize } from "./model";
import { applyPatches } from "./patches";
import { lightsOut, stepsOf, wakeAt } from "./routine";
import { DEFAULT_ROUTINES } from "./routineDefaults";
import { seedPlan } from "./seed";

describe("mises à jour envoyées par Claude", () => {
  it("s'appliquent une seule fois et réécrivent une journée", () => {
    const p0 = normalize(seedPlan());
    const lundi = expand(p0, "2026-11-23", "2026-11-23");
    const micro = lundi.find((o) => o.cat === "micro")!;
    const patch = {
      id: "maths-focus",
      note: "Focus maths",
      ops: [
        { op: "edit" as const, key: micro.key, patch: { title: "Maths khôlle · exercices", cat: "maths" } },
        { op: "add" as const, activity: { id: "mk-1", title: "Maths khôlle · khôlle blanche", cat: "maths", prio: "important" as const, date: "2026-11-23", start: "15:20", end: "16:05", check: true } },
        { op: "delete" as const, key: lundi.find((o) => o.cat === "synthese" && o.start)!.key },
      ],
    };
    const r = applyPatches(p0, [patch]);
    expect(r.notes).toEqual(["Focus maths"]);
    const after = expand(r.plan, "2026-11-23", "2026-11-23");
    expect(after.find((o) => o.key === micro.key)!.cat).toBe("maths");
    expect(after.some((o) => o.title === "Maths khôlle · khôlle blanche")).toBe(true);
    expect(after.some((o) => o.cat === "synthese" && o.start)).toBe(false);
    // déjà appliquée : rien ne bouge
    const again = applyPatches(r.plan, [patch]);
    expect(again.plan).toBe(r.plan);
    expect(again.notes).toEqual([]);
  });

  it("clearDay libère la journée mais garde cours, repas, sport et ce qui est fait", () => {
    const p0 = normalize(seedPlan());
    const r = applyPatches(p0, [{ id: "x", ops: [{ op: "clearDay", date: "2026-11-23", keepIds: ["t-skool"] }] }]);
    const left = expand(r.plan, "2026-11-23", "2026-11-23");
    expect(left.filter((o) => o.check && !o.key.startsWith("t-skool@") && ["maths", "micro", "synthese", "macro", "anki", "espagnol"].includes(o.cat))).toHaveLength(0);
    expect(left.some((o) => o.cat === "course")).toBe(true);
    expect(left.some((o) => o.id === "t-skool" || o.key.startsWith("t-skool@"))).toBe(true);
  });

  it("peut changer les routines et les horaires", () => {
    const p0 = normalize(seedPlan());
    const sched = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ wake: [1, 2, 4].includes(i) ? "07:00" : i < 5 ? "08:00" : "10:00", bed: i === 4 || i === 5 ? undefined : [0, 1, 3].includes(i) ? "23:00" : "23:15" }));
    const r = applyPatches(p0, [{ id: "r", ops: [{ op: "routines", routines: DEFAULT_ROUTINES }, { op: "schedule", schedule: sched, from: "2026-11-22" }] }]);
    expect(wakeAt(r.plan, "2026-11-24")).toBe("07:00");
    expect(lightsOut(r.plan, "2026-11-23")).toBe("23:00");
    expect(stepsOf(r.plan, "matin", "2026-11-27").some((s) => s.id === "m-actu")).toBe(true); // vendredi : quiz d'actu
    expect(stepsOf(r.plan, "matin", "2026-11-24").some((s) => s.id === "m-actu")).toBe(false);
  });
});
