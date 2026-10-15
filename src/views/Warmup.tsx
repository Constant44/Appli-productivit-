import { useState } from "react";
import { useActiveCards, useStore } from "../lib/store";
import { buildQueue } from "../lib/srs";
import { useAi } from "../lib/ai";
import type { Card } from "../lib/types";
import { isoDay } from "../lib/utils";
import { ReviewSession } from "../components/Review";
import { EnglishQuiz } from "../components/English";
import { useSessionClock } from "./Vendredi";

type Step = "intro" | "cards" | "english" | "done";

/**
 * L'échauffement : 15 minutes, toujours le même enchaînement, pour lancer la journée sans réfléchir.
 * 1) cartes à revoir (actu, personnages, mots, erreurs d'anglais)  2) 5 questions de QCM d'anglais.
 */
export default function Warmup() {
  const cards = useActiveCards();
  const reviews = useStore((s) => s.reviews);
  const warmups = useStore((s) => s.warmups);
  const markWarmup = useStore((s) => s.markWarmup);
  const ai = useAi((s) => s.available);
  const [step, setStep] = useState<Step>("intro");
  const [queue, setQueue] = useState<Card[]>([]);
  const [result, setResult] = useState({ cards: "", english: "" });
  const clock = useSessionClock();
  const doneToday = warmups.includes(isoDay(new Date()));

  const finish = (english: string) => {
    setResult((r) => ({ ...r, english }));
    setStep("done");
    markWarmup();
    clock.log("Culture générale", "Échauffement");
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 className="page-title">Échauffement</h1>
      <p className="page-sub">15 minutes, toujours pareil : on ne réfléchit pas, on lance. Le plus dur, c'est de commencer.</p>

      {step === "intro" && (
        <div className="card stack">
          <div className="row" style={{ gap: 18 }}>
            <div className="stat"><span className="v">1</span><span className="l">Cartes du jour (~8 min)</span></div>
            <div className="stat"><span className="v">2</span><span className="l">5 QCM d'anglais (~5 min)</span></div>
          </div>
          {doneToday && <div className="pill green">✓ Déjà fait aujourd'hui, mais tu peux en refaire un</div>}
          <button
            className="btn primary big"
            onClick={() => {
              const q = buildQueue(cards, reviews, { newLimit: 8, max: 15 });
              setQueue(q);
              clock.reset();
              setStep(q.length ? "cards" : ai ? "english" : "done");
              if (!q.length && !ai) finish("");
            }}
          >
            🔥 Coup d'envoi
          </button>
        </div>
      )}

      {step === "cards" && (
        <div className="card">
          <ReviewSession
            queue={queue}
            title="Étape 1/2 · cartes"
            onDone={(st) => {
              setResult((r) => ({ ...r, cards: `${st.ok}/${st.seen}` }));
              if (ai === false) finish("");
              else setStep("english");
            }}
          />
        </div>
      )}

      {step === "english" && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 10 }}>Étape 2/2 · QCM d'anglais (format EDHEC)</div>
          <EnglishQuiz count={5} onDone={(s, t) => finish(`${s}/${t}`)} />
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => finish("")}>Passer cette étape</button>
        </div>
      )}

      {step === "done" && (
        <div className="card stack" style={{ borderColor: "var(--accent)" }}>
          <div className="flash-front">🔥 Échauffement terminé !</div>
          <div className="small">
            {result.cards && <>Cartes : <b>{result.cards}</b> · </>}
            {result.english && <>Anglais : <b>{result.english}</b></>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Maintenant que la machine est lancée, enchaîne directement sur une vraie session de travail.</p>
          <a className="btn primary" href="#focus">▶ Enchaîner sur une session Focus</a>
        </div>
      )}
    </div>
  );
}
