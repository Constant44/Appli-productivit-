import { describe, expect, it } from "vitest";
import { expand, normalize, toggleDone, type Activity } from "./model";
import { mergePlans, mergeQuiz } from "./merge";
import { seedPlan } from "./seed";

describe("synchronisation entre appareils", () => {
  it("une modification de chaque appareil survit à la fusion", () => {
    const base = normalize(seedPlan());
    const key = expand(base, "2026-11-23", "2026-11-23").find((o) => o.cat === "maths")!.key;
    const key2 = expand(base, "2026-11-24", "2026-11-24").find((o) => o.check)!.key;
    const phone = { ...toggleDone(base, key), sleep: { "2026-11-23": { wake: "x" } } };
    const extra: Activity = { id: "u1", title: "Ajout sur le Mac", cat: "maths", prio: "important", date: "2026-11-25", start: "10:00", end: "11:00", check: true };
    const mac = { ...toggleDone(base, key2), activities: [...base.activities, extra], sleep: { "2026-11-23": { bed: "y" } } };
    const m = mergePlans(mac, phone);
    expect(m.done[key]).toBeTruthy();
    expect(m.done[key2]).toBeTruthy();
    expect(m.activities.some((a) => a.id === "u1")).toBe(true);
    expect(m.sleep["2026-11-23"]).toEqual({ wake: "x", bed: "y" });
    expect(m.activities.length).toBe(base.activities.length + 1);
  });

  it("quiz : la réponse la plus récente gagne", () => {
    const q = mergeQuiz({ a: { ok: 2, ko: 0, last: "2026-11-25" } }, { a: { ok: 1, ko: 1, last: "2026-11-24" }, b: { ok: 1, ko: 0, last: "2026-11-20" } });
    expect(q.a.ok).toBe(2);
    expect(q.b).toBeTruthy();
  });
});
