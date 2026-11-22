import { describe, expect, it } from "vitest";
import { pullInbox } from "./platform";
import { useStore } from "./store";

const docs = (list: Array<{ id: string; data: unknown }>) => ({ docs: list.map((d) => ({ id: d.id, data: () => Object.freeze(d.data) })) });

describe("boîte de réception", () => {
  it("l'actu passe même si l'inbox Pronote échoue, et les cartes perdues d'un paquet déjà importé reviennent", async () => {
    useStore.setState({
      inboxDone: ["mots-x"],
      sheets: [{ id: "P32", kind: "bio", title: "Confucius", body: "…", sentAt: "2026-11-04" }],
      cards: [],
    });
    const shared = docs([
      { id: "actu-2026-11-16", data: { actuDays: [{ id: "2026-11-16", title: "Actu" }], cards: [{ id: "actu-2026-11-16-1", deck: "actu", ref: "2026-11-16", date: "2026-11-16", front: "q", back: "r" }] } },
      { id: "mots-x", data: { sheets: [{ id: "P32", kind: "bio", title: "Confucius", body: "…", sentAt: "2026-11-04" }], cards: [{ id: "P32-1", deck: "bio", ref: "P32", front: "q", back: "r" }] } },
    ]);
    const query = (get: () => Promise<unknown>) => { const q = { limit: () => q, where: () => q, get }; return q; };
    const db = { collection: (p: string) => (p === "inbox" ? query(async () => shared) : query(async () => { throw new Error("trop gros"); })) };
    await pullInbox(db, "data/users/u1");
    const s = useStore.getState();
    expect(s.cards.map((c) => c.id).sort()).toEqual(["P32-1", "actu-2026-11-16-1"]);
    expect(s.inboxDone).toContain("actu-2026-11-16");
  });
});
