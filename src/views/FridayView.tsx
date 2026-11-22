/** VENDREDI (onglet tranquille) : quiz de l'actu de la semaine et des mots / persos encore en jeu. */
import { useMemo, useState } from "react";
import { fmtLong } from "../lib/dates";
import { drawQuiz, inActuWeek, nextTestDay, testFocus } from "../lib/quiz";
import { useStore, type QCard } from "../lib/store";
import { toggleFallen } from "../lib/cloud";

export default function FridayView() {
  const content = useStore((s) => s.content);
  const quiz = useStore((s) => s.quiz);
  const rate = useStore((s) => s.rateCard);
  const [deck, setDeck] = useState<QCard[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState(0);
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const test = nextTestDay();
  const focus = testFocus();

  const alive = (c: QCard) => !c.ref || !content.fallen.includes(c.ref);
  const actu = useMemo(() => content.cards.filter((c) => c.deck === "actu" && inActuWeek(c)), [content.cards]);
  const words = useMemo(() => content.cards.filter((c) => c.deck === focus && alive(c)), [content, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useMemo(() => content.cards.filter((c) => (c.deck === "mot" || c.deck === "bio") && c.deck !== focus && alive(c)), [content, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheets = content.sheets.filter((s) => s.kind === focus && !content.fallen.includes(s.id)).sort((a, b) => b.id.localeCompare(a.id, "fr", { numeric: true }));

  const start = (cards: QCard[]) => {
    setDeck(drawQuiz(cards, quiz, 15));
    setI(0);
    setShown(false);
    setScore(0);
  };
  const answer = (ok: boolean) => {
    rate(deck![i].id, ok);
    if (ok) setScore((s) => s + 1);
    setShown(false);
    setI((x) => x + 1);
  };

  if (deck) {
    const card = deck[i];
    return (
      <div className="friday">
        <div className="quiz card">
          {card ? (
            <>
              <div className="quiz-top"><span className="eyebrow">{card.deck === "actu" ? "Actu" : card.deck === "mot" ? "Mot" : "Personnage"} · {i + 1}/{deck.length}</span><button className="btn xs ghost" onClick={() => setDeck(null)}>Arrêter</button></div>
              <p className="quiz-q">{card.front}</p>
              {shown ? (
                <>
                  <p className="quiz-a">{card.back}</p>
                  <div className="row gap"><button className="btn danger-ghost" onClick={() => answer(false)}>À revoir</button><button className="btn primary" onClick={() => answer(true)}>Je savais</button></div>
                </>
              ) : (
                <button className="btn primary" onClick={() => setShown(true)}>Voir la réponse</button>
              )}
            </>
          ) : (
            <>
              <p className="quiz-q">Terminé : {score}/{deck.length}</p>
              <p className="muted">Les cartes ratées reviendront en priorité au prochain tirage.</p>
              <button className="btn primary" onClick={() => setDeck(null)}>Retour</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="friday">
      <header className="view-head">
        <div>
          <span className="eyebrow">Test d'actu · 8 h</span>
          <h1 className="view-title">Prochain test : {fmtLong(test)}</h1>
          <p className="muted">Semaine {focus === "mot" ? "des mots (2 mots)" : "du personnage"} · actu du vendredi au jeudi soir. Les questions arrivent chaque soir depuis ton Drive et les mails du prof.</p>
        </div>
      </header>
      <div className="fri-grid">
        <button className="fri-card" disabled={!actu.length} onClick={() => start(actu)}><b>{actu.length}</b><span>questions d'actu de la semaine</span><em>Quiz actu →</em></button>
        <button className="fri-card" disabled={!words.length} onClick={() => start(words)}><b>{words.length}</b><span>{focus === "mot" ? "mots encore en jeu" : "cartes personnages en jeu"}</span><em>Quiz {focus === "mot" ? "mots" : "persos"} →</em></button>
        <button className="fri-card muted-card" disabled={!others.length} onClick={() => start(others)}><b>{others.length}</b><span>{focus === "mot" ? "cartes personnages" : "mots"} (l'autre semaine)</span><em>Petit entretien →</em></button>
      </div>
      <section className="card">
        <h3 className="h3">{focus === "mot" ? "Mots" : "Personnages"} en jeu</h3>
        <p className="muted small">Quand l'un d'eux tombe au test, marque-le : il sort des révisions.</p>
        <ul className="sheet-list">
          {sheets.map((s) => (
            <li key={s.id}>
              <div className="row between">
                <button className="link" onClick={() => setOpenSheet(openSheet === s.id ? null : s.id)}><b>{s.title}</b> <span className="muted small">{s.id}</span></button>
                <button className="btn xs ghost" onClick={() => void toggleFallen(s.id)}>Tombé au test</button>
              </div>
              {openSheet === s.id && <p className="sheet-text">{s.body}</p>}
            </li>
          ))}
        </ul>
        {content.fallen.length > 0 && <p className="muted small">Déjà tombés : {content.sheets.filter((s) => content.fallen.includes(s.id)).map((s) => s.title).join(", ")}.</p>}
      </section>
    </div>
  );
}
