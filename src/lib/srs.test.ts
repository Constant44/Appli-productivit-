import { describe, expect, it } from "vitest";
import { buildQueue, nextTestDay, schedule, type Review } from "./srs";
import { isoDay } from "./utils";
import type { Card } from "./types";
import seed from "../data/seed.json";

const thu = new Date("2026-10-15T20:00:00");
const card = (id: string, deck: Card["deck"] = "bio", date?: string): Card => ({ id, deck, front: id, back: id, date });

describe("répétition espacée", () => {
  it("intervalles croissants sur bonnes réponses : 1 → 3 → ~8 jours", () => {
    let r: Review | undefined;
    const ivs: number[] = [];
    let now = new Date("2026-10-01T09:00:00");
    for (let i = 0; i < 3; i++) {
      r = schedule(r, 2, { deck: "mot" }, now);
      ivs.push(r.interval);
      now = new Date(r.due);
    }
    expect(ivs).toEqual([1, 3, 8]);
  });
  it("un échec fait revenir la carte dans 10 minutes et baisse la facilité", () => {
    const r = schedule({ due: "", interval: 8, ease: 2.5, reps: 3, lapses: 0, last: "" }, 0, { deck: "bio" }, thu);
    expect(+new Date(r.due) - +thu).toBe(10 * 60000);
    expect(r.ease).toBeCloseTo(2.3);
  });
  it("une carte d'actu revient au plus tard la veille du test", () => {
    const mon = new Date("2026-10-12T09:00:00");
    const r = schedule({ due: "", interval: 3, ease: 2.5, reps: 2, lapses: 0, last: "" }, 3, { deck: "actu" }, mon);
    expect(new Date(r.due).getDate()).toBe(15); // jeudi 15, veille du vendredi 16
  });
  it("le prochain test d'un jeudi soir est le lendemain", () => {
    expect(nextTestDay(thu).getDate()).toBe(16);
  });
  it("pas de test pendant les vacances : après la Toussaint, c'est le vendredi 6/11", () => {
    expect(isoDay(nextTestDay(new Date("2026-10-21T10:00:00")))).toBe("2026-11-06");
  });
  it("la file met l'actu de la semaine devant et respecte la limite de nouvelles cartes", () => {
    const cards = [card("b1"), card("b2"), card("a1", "actu", "2026-10-12"), card("old", "actu", "2026-09-01")];
    const q = buildQueue(cards, {}, { newLimit: 2, max: 10 }, thu);
    expect(q.map((c) => c.id)).toEqual(["a1", "b1"]);
  });
});

describe("fiches déjà tombées", () => {
  it("les cartes d'une fiche tombée sortent des révisions, l'actu reste", async () => {
    const { activeCards } = await import("./store");
    const cards = [card("P28-1"), card("a1", "actu", "2026-10-12")].map((c) => ({ ...c, ref: c.id.startsWith("P28") ? "P28" : undefined }));
    expect(activeCards({ cards, fallen: ["P28"] }).map((c) => c.id)).toEqual(["a1"]);
  });
});

describe("contenu embarqué", () => {
  it("21 fiches, chaque carte a une fiche ou une date, aucun caractère de contrôle", () => {
    const s = seed as { sheets: Array<{ id: string; body: string }>; cards: Card[] };
    expect(s.sheets).toHaveLength(21);
    const ids = new Set(s.sheets.map((x) => x.id));
    for (const c of s.cards) expect(c.deck === "actu" ? !!c.date : ids.has(c.ref!)).toBe(true);
    expect(JSON.stringify(seed)).not.toMatch(/[\u0000-\u0008\u000b-\u001f]/);
    expect(new Set(s.cards.map((c) => c.id)).size).toBe(s.cards.length);
    // une seule carte par mot : la définition
    expect(s.cards.filter((c) => c.deck === "mot").every((c) => c.id.endsWith("-def"))).toBe(true);
  });
  it("la migration retire les cartes d'étymologie et leur historique", async () => {
    const { onlyDefinitions } = await import("./store");
    const r = onlyDefinitions({
      cards: [card("M63-def", "mot"), card("M63-ety", "mot"), card("M63-rev", "mot"), card("P31-1")],
      reviews: { "M63-ety": { due: "", interval: 3, ease: 2.5, reps: 1, lapses: 0, last: "" } },
      sheets: [],
    });
    expect(r.cards.some((c) => c.id === "M63-ety" || c.id === "M63-rev")).toBe(false);
    expect(r.cards.some((c) => c.id === "P31-1")).toBe(true);
    expect(r.reviews).toEqual({});
  });
});
