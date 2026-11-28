import { describe, expect, it } from "vitest";
import { sunUTC } from "./sun";

const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;

describe("soleil à Bordeaux", () => {
  it("lever et coucher plausibles (heure UTC) au fil de l'année", () => {
    const nov = sunUTC("2026-11-22");
    const dec = sunUTC("2026-12-21");
    const jun = sunUTC("2027-06-21");
    expect(hm(nov.rise)).toMatch(/^7:/);
    // vérification indépendante : midi solaire = 12 h − 4 min × longitude − équation du temps (~+14 min fin novembre),
    // durée du jour ~9 h 20 à 44,8° N → lever ~7 h 08 UTC (8 h 08 à Paris), coucher ~16 h 29 UTC (17 h 29)
    expect(Math.abs(nov.rise - (7 * 60 + 8))).toBeLessThan(4);
    expect(Math.abs(nov.set - (16 * 60 + 29))).toBeLessThan(4);
    expect(Math.abs(dec.rise - (7 * 60 + 35))).toBeLessThan(6);
    expect(Math.abs(jun.rise - (4 * 60 + 13))).toBeLessThan(6);
    expect(jun.set - jun.rise).toBeGreaterThan(15 * 60); // ~15 h 40 de jour à Bordeaux au solstice
  });
});
