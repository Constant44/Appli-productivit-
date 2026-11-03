import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { DECK_LABEL, type Card } from "../lib/types";
import type { Rating } from "../lib/srs";
import { fmtDay } from "../lib/utils";
import { Bar } from "./ui";

const RATINGS: Array<[Rating, string, string]> = [
  [0, "Raté", "danger"],
  [1, "Difficile", ""],
  [2, "Bien", "primary"],
  [3, "Facile", "gold"],
];

/**
 * Séance de révision : on montre le recto, l'élève essaie de répondre de tête, retourne la carte,
 * puis s'auto-évalue. Les cartes ratées reviennent en fin de séance.
 */
export function ReviewSession({ queue: initial, onDone, title }: { queue: Card[]; onDone: (stats: { seen: number; ok: number }) => void; title?: string }) {
  const rateCard = useStore((s) => s.rateCard);
  const sheets = useStore((s) => s.sheets);
  const [queue, setQueue] = useState(initial);
  const [shown, setShown] = useState(false);
  const [stats, setStats] = useState({ seen: 0, ok: 0 });
  const [showSheet, setShowSheet] = useState(false);
  const card = queue[0];
  const total = initial.length;

  const rate = (r: Rating) => {
    if (!card) return;
    rateCard(card.id, r);
    const next = queue.slice(1);
    if (r === 0) next.push(card); // revient en fin de séance
    const st = { seen: stats.seen + 1, ok: stats.ok + (r > 0 ? 1 : 0) };
    setStats(st);
    setShown(false);
    setShowSheet(false);
    setQueue(next);
    if (next.length === 0) onDone(st);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setShown(true); }
      else if (shown && ["1", "2", "3", "4"].includes(e.key)) rate((Number(e.key) - 1) as Rating);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!card) return <div className="empty">Rien à réviser pour l'instant 🎉</div>;
  const sheet = card.ref ? sheets.find((s) => s.id === card.ref) : undefined;
  const remainingUnique = new Set(queue.map((c) => c.id)).size;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between small">
        <span>{title ?? "Révision"} · <b>{total - remainingUnique}</b>/{total}</span>
        <span className="muted">{stats.seen ? `${Math.round((stats.ok / stats.seen) * 100)} % de réussite` : "Espace : retourner · 1-4 : noter"}</span>
      </div>
      <Bar value={total - remainingUnique} max={total} />
      <div className="desk-top">
      <div className={`flashcard ${shown ? "revealed" : ""}`} key={card.id}>
        <div className="row between small">
          <span className="pill">{DECK_LABEL[card.deck]}{card.deck === "actu" && card.date ? ` · ${fmtDay(card.date)}` : ""}</span>
          {sheet && <span className="muted">{sheet.id} · {sheet.title}</span>}
        </div>
        <div className="flash-front">{card.front}</div>
        {shown ? (
          <div className="flash-back">{card.back}</div>
        ) : (
          <button className="btn big primary" style={{ alignSelf: "center" }} onClick={() => setShown(true)}>Retourner la carte</button>
        )}
      </div>
      </div>
      {shown && (
        <>
          <div className="rating-row">
            {RATINGS.map(([r, label, cls]) => (
              <button key={r} className={`btn ${cls}`} onClick={() => rate(r)}>{label}</button>
            ))}
          </div>
          {sheet && (
            <button className="btn sm ghost" style={{ alignSelf: "center" }} onClick={() => setShowSheet(!showSheet)}>
              {showSheet ? "Masquer la fiche" : "📄 Voir la fiche complète"}
            </button>
          )}
          {showSheet && sheet && <div className="sheet-body small">{sheet.body}</div>}
        </>
      )}
    </div>
  );
}
