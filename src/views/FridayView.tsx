/** VENDREDI (onglet tranquille) : quiz de l'actu de la semaine et des mots / persos encore en jeu. */
import { useMemo, useState } from "react";
import { fmtLong } from "../lib/dates";
import { drawQuiz, inActuWeek, nextTestDay, testFocus } from "../lib/quiz";
import { useStore, type QCard } from "../lib/store";
import { toggleFallen } from "../lib/cloud";
import { capability } from "../lib/runtime";

export default function FridayView() {
  const content = useStore((s) => s.content);
  const quiz = useStore((s) => s.quiz);
  const rate = useStore((s) => s.rateCard);
  const [deck, setDeck] = useState<QCard[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState(0);
  const [typed, setTyped] = useState("");
  const [checking, setChecking] = useState(false);
  const [fb, setFb] = useState<{ verdict: "juste" | "partiel" | "faux"; note: string; missing: string } | null>(null);
  const [err, setErr] = useState("");
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [libKind, setLibKind] = useState<"mot" | "bio">("mot");
  const [libQ, setLibQ] = useState("");
  const allOf = (k: "mot" | "bio") => content.sheets.filter((x) => x.kind === k).sort((a, b) => b.id.localeCompare(a.id, "fr", { numeric: true }));
  const test = nextTestDay();
  const focus = testFocus();

  const alive = (c: QCard) => !c.ref || !content.fallen.includes(c.ref);
  const actu = useMemo(() => content.cards.filter((c) => c.deck === "actu" && inActuWeek(c)), [content.cards]);
  const words = useMemo(() => content.cards.filter((c) => c.deck === focus && alive(c)), [content, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useMemo(() => content.cards.filter((c) => (c.deck === "mot" || c.deck === "bio") && c.deck !== focus && alive(c)), [content, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (cards: QCard[]) => {
    setDeck(drawQuiz(cards, quiz, 15));
    setI(0);
    setShown(false);
    setScore(0);
    setTyped("");
    setFb(null);
  };
  const answer = (ok: boolean) => {
    rate(deck![i].id, ok);
    if (ok) setScore((s) => s + 1);
    setShown(false);
    setTyped("");
    setFb(null);
    setErr("");
    setI((x) => x + 1);
  };
  // Claude corrige la réponse tapée (même logique que le prof : le sens exact compte, pas les mots)
  const correct = async (card: QCard) => {
    setErr("");
    const sample = await capability("sample");
    if (!sample) {
      setErr("La correction par Claude n'est pas disponible ici : compare toi-même avec la réponse.");
      setShown(true);
      return;
    }
    setChecking(true);
    try {
      const kind = card.deck === "mot" ? "une définition de mot (test de culture générale en prépa)" : card.deck === "bio" ? "une question sur un personnage historique" : "une question d'actualité";
      const r = await sample.json(
        `Tu corriges un étudiant de prépa sur ${kind}. Sois exigeant mais juste : ce qui compte, c'est le sens exact, pas la formulation. Pour une définition à plusieurs sens, il faut les sens principaux.
Question : ${card.front}
Réponse attendue : ${card.back}
Réponse de l'étudiant : ${typed}
Réponds UNIQUEMENT en JSON : {"verdict":"juste"|"partiel"|"faux","note":"une phrase en français, tutoiement, qui dit ce qui est juste ou faux","missing":"ce qui manque, en quelques mots, ou chaîne vide"}`,
        { modelTier: "quick" },
      );
      const v = ["juste", "partiel", "faux"].includes(r?.verdict) ? r.verdict : "partiel";
      setFb({ verdict: v, note: String(r?.note ?? ""), missing: String(r?.missing ?? "") });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setErr(code === "not_granted" ? "Correction refusée : autorise Claude pour cette appli (menu Autorisations) ou compare toi-même." : "Claude n'a pas pu corriger cette fois : compare toi-même avec la réponse.");
    } finally {
      setChecking(false);
      setShown(true);
    }
  };

  if (deck) {
    const card = deck[i];
    return (
      <div className="friday quiz-mode">
        <div className="quiz card">
          {card ? (
            <>
              <div className="quiz-top"><span className="eyebrow">{card.deck === "actu" ? "Actu" : card.deck === "mot" ? "Mot" : "Personnage"} · {i + 1}/{deck.length}</span><button className="btn xs ghost" onClick={() => setDeck(null)}>Arrêter</button></div>
              <p className="quiz-q">{card.front}</p>
              {!shown && (
                <>
                  <textarea id="qz-answer" className="input quiz-in" rows={card.deck === "mot" ? 4 : 2} value={typed} onChange={(e) => setTyped(e.target.value)}
                    placeholder={card.deck === "mot" ? "Écris la définition comme au test…" : "Ta réponse…"} />
                  <div className="row gap quiz-actions">
                    <button className="btn primary" disabled={!typed.trim() || checking} onClick={() => void correct(card)}>{checking ? "Claude corrige…" : "Corriger avec Claude"}</button>
                    <button className="btn ghost" onClick={() => setShown(true)}>Voir la réponse</button>
                  </div>
                  {err && <p className="muted small">{err}</p>}
                </>
              )}
              {shown && (
                <>
                  {err && <p className="muted small">{err}</p>}
                  {typed.trim() && <p className="quiz-mine"><span className="muted small">Ta réponse</span><br />{typed}</p>}
                  {fb && (
                    <div className={`quiz-fb v-${fb.verdict}`}>
                      <b>{fb.verdict === "juste" ? "Juste" : fb.verdict === "partiel" ? "En partie" : "Pas encore"}{fb.note ? " · " : ""}</b>{fb.note}
                      {fb.missing && <p className="small">Il manquait : {fb.missing}</p>}
                    </div>
                  )}
                  <p className="quiz-a">{card.back}</p>
                  <div className="row gap quiz-actions"><button className={`btn ${fb && fb.verdict !== "juste" ? "primary" : "danger-ghost"}`} onClick={() => answer(false)}>À revoir</button><button className={`btn ${!fb || fb.verdict === "juste" ? "primary" : "ghost"}`} onClick={() => answer(true)}>Je savais</button></div>
                </>
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
      <section className="card lib">
        <div className="row between wrap gap">
          <h3 className="h3">Tous les mots et personnages</h3>
          <div className="seg">
            <button className={libKind === "mot" ? "on" : ""} onClick={() => setLibKind("mot")}>Mots ({allOf("mot").length})</button>
            <button className={libKind === "bio" ? "on" : ""} onClick={() => setLibKind("bio")}>Personnages ({allOf("bio").length})</button>
          </div>
        </div>
        <input id="lib-q" className="input" placeholder={libKind === "mot" ? "Chercher un mot…" : "Chercher un personnage…"} value={libQ} onChange={(e) => setLibQ(e.target.value)} />
        <p className="muted small">Quand l'un d'eux tombe au test, appuie sur « Tombé » : il sort des quiz (il reste visible ici, grisé). Un appui de plus le remet.</p>
        <ul className="lib-list">
          {allOf(libKind).filter((x) => !libQ.trim() || x.title.toLowerCase().includes(libQ.trim().toLowerCase())).map((x) => {
            const fell = content.fallen.includes(x.id);
            const def = content.cards.find((c) => c.ref === x.id && c.id.endsWith("-def"));
            const facts = content.cards.filter((c) => c.ref === x.id && c.deck === "bio");
            return (
              <li key={x.id} className={fell ? "fell" : ""}>
                <div className="lib-head">
                  <button className="link" onClick={() => setOpenSheet(openSheet === x.id ? null : x.id)}><b>{x.title}</b> <span className="muted small">{x.id}</span></button>
                  <button className={`btn xs ${fell ? "" : "ghost"}`} onClick={() => void toggleFallen(x.id)}>{fell ? "Tombé ✓" : "Tombé"}</button>
                </div>
                {libKind === "mot" ? (
                  <p className="lib-def">{def?.back ?? defOnly(x.body)}</p>
                ) : (openSheet !== x.id ? <p className="lib-def">{facts[0]?.back ?? ""} <button className="link small" onClick={() => setOpenSheet(x.id)}>tout voir</button></p> : (
                  <ul className="lib-facts">
                    {facts.map((c) => <li key={c.id}><span className="muted">{c.front.replace(/^.*? — /, "")}</span> {c.back}</li>)}
                  </ul>
                ))}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Si la carte de définition manque : la ligne « Définition : … » de la fiche, sans étymologie ni exemple. */
function defOnly(body: string) {
  const line = body.split("\n").find((l) => /^D[ée]finition/i.test(l.trim()));
  return (line ?? body.split("\n")[0]).replace(/^D[ée]finition\s*:\s*/i, "");
}
