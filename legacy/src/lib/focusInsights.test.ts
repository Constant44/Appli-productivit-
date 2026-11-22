import { describe, expect, it } from "vitest";
import { focusInsights, knownPlaces } from "./focusInsights";
import type { Session } from "./types";

const s = (start: string, focus10: number, place: string, subject = "Maths", minutes = 25): Session => ({ id: start, start, minutes, focus10, place, subject, xp: 0, coins: 0 });

describe("concentration par lieu et moment", () => {
  it("trouve le meilleur créneau et ignore les groupes trop petits", () => {
    const list = [
      s("2026-11-03T09:00:00+01:00", 9, "BU"), s("2026-11-04T09:30:00+01:00", 8, "BU"), s("2026-11-05T10:00:00+01:00", 9, "BU"),
      s("2026-11-03T20:00:00+01:00", 4, "Chez moi", "Microéconomie"), s("2026-11-04T20:30:00+01:00", 5, "Chez moi", "Microéconomie"), s("2026-11-05T21:00:00+01:00", 3, "Chez moi", "Microéconomie"),
      s("2026-11-06T15:00:00+01:00", 10, "Train"),
    ];
    const f = focusInsights(list);
    expect(f.rated).toBe(7);
    expect(f.best?.key).toBe("le matin, à la BU");
    expect(f.best?.avg).toBeCloseTo(26 / 3, 5);
    expect(f.worstSubject?.key).toBe("Microéconomie");
    expect(knownPlaces(list)[0]).toBe("Train");
  });
});
