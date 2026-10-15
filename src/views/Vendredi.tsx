import { useMemo, useRef, useState } from "react";
import { useActiveCards, useStore } from "../lib/store";
import { actuWeekStart, buildQueue, isDue, nextTestDay, shuffle } from "../lib/srs";
import { askJson, AiError, useAi } from "../lib/ai";
import type { Card, Deck, Sheet } from "../lib/types";
import { addDays, daysUntil, fmtDay, isoDay } from "../lib/utils";
import { Bar, Field, Modal, Seg } from "../components/ui";
import { ReviewSession } from "../components/Review";
import { ask } from "../components/confirm";

type Tab = "review" | "sheets" | "blank" | "actu" | "results";

/** Exemple réel du prof (Devoir de CG n°3, 1er octobre 2026) pour caler le style des questions générées. */
const PROF_STYLE = `Exemples de questions du professeur (test du 1er octobre) :
- La hausse des taux américains pose des soucis à Scott Bessent. Qui est-ce ? → Le secrétaire d'État au Trésor.
- Dans quel pays la France va-t-elle envoyer des moyens militaires ? → L'Arabie saoudite.
- Les dangers hypothétiques de l'I.A. sont regroupés sous un néologisme. Lequel ? → L'IApocalypse.
- Aux Pays-Bas, qu'est-ce qui pourrait sortir du code pénal ? → L'avortement.
- Menacé d'une contribution exceptionnelle, CMA CGM renonce à un de ses engagements. Lequel ? → Enregistrer 40 navires sous pavillon français.`;

export default function Vendredi() {
  const [tab, setTab] = useState<Tab>("review");
  const test = nextTestDay();
  const d = daysUntil(test);
  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Test du vendredi</h1>
          <p className="page-sub">
            Prochain test : <b>{fmtDay(test)}</b> ({d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} jours`}) · 10 questions d'actu + une bio ou deux définitions, tout depuis la rentrée.
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[["review", "🧠 Réviser"], ["sheets", "📄 Fiches"], ["blank", "🎲 Tirage blanc"], ["actu", "🗞️ Actu"], ["results", "📈 Résultats"]]} />
      </div>
      {tab === "review" && <ReviewTab />}
      {tab === "sheets" && <SheetsTab />}
      {tab === "blank" && <BlankTab />}
      {tab === "actu" && <ActuTab />}
      {tab === "results" && <ResultsTab />}
    </>
  );
}

// ------------------------------------------------------------------ Réviser

function useDeckStats(decks: Deck[]) {
  const cards = useActiveCards();
  const reviews = useStore((s) => s.reviews);
  return useMemo(() => {
    const ws = actuWeekStart();
    return decks.map((deck) => {
      let list = cards.filter((c) => c.deck === deck);
      if (deck === "actu") list = list.filter((c) => !c.date || new Date(c.date) >= new Date(+ws - 864e5));
      return {
        deck,
        total: list.length,
        fresh: list.filter((c) => !reviews[c.id]).length,
        due: list.filter((c) => isDue(reviews[c.id])).length,
        solid: list.filter((c) => (reviews[c.id]?.interval ?? 0) >= 7).length,
      };
    });
  }, [cards, reviews, decks]);
}

export function useSessionClock() {
  const start = useRef(Date.now());
  const logSession = useStore((s) => s.logSession);
  return {
    reset: () => { start.current = Date.now(); },
    log: (subject: string, note?: string) => {
      const minutes = Math.round((Date.now() - start.current) / 60000);
      if (minutes >= 1) logSession({ minutes, subject, focus: 4, note, start: new Date(start.current).toISOString() });
    },
  };
}

function ReviewTab() {
  const cards = useActiveCards();
  const reviews = useStore((s) => s.reviews);
  const stats = useDeckStats(["actu", "bio", "mot"]);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState<{ seen: number; ok: number } | null>(null);
  const clock = useSessionClock();
  const eve = daysUntil(nextTestDay()) <= 1;

  const start = (q: Card[], l: string) => {
    setSummary(null);
    setLabel(l);
    clock.reset();
    setQueue(q);
  };
  const daily = () => buildQueue(cards, reviews, { newLimit: 20, max: 40, decks: ["actu", "bio", "mot"] });
  const eveQueue = () => {
    const ws = +actuWeekStart() - 864e5;
    const actu = cards.filter((c) => c.deck === "actu" && (!c.date || +new Date(c.date) >= ws));
    const weak = cards
      .filter((c) => c.deck !== "actu" && c.deck !== "anglais" && c.deck !== "micro")
      .sort((a, b) => (reviews[a.id]?.interval ?? -1) - (reviews[b.id]?.interval ?? -1))
      .slice(0, 30);
    return [...shuffle(actu), ...shuffle(weak)];
  };

  if (queue)
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <ReviewSession
          queue={queue}
          title={label}
          onDone={(st) => {
            setQueue(null);
            setSummary(st);
            clock.log("Culture générale", `Révision ${label} : ${st.ok}/${st.seen}`);
          }}
        />
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => { setQueue(null); clock.log("Culture générale"); }}>Arrêter la séance</button>
      </div>
    );

  return (
    <div className="stack" style={{ gap: 16 }}>
      {summary && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          ✅ Séance terminée : <b>{summary.ok}/{summary.seen}</b> réponses justes du premier coup ou après reprise. Les cartes ratées reviendront plus tôt.
        </div>
      )}
      <div className="deck-stats">
        {stats.map((s) => (
          <div key={s.deck} className="card stat">
            <span className="l">{s.deck === "actu" ? "Actu de la semaine" : s.deck === "bio" ? "Personnages" : "Mots"}</span>
            <span className="v">{s.due + s.fresh}</span>
            <span className="small muted">à voir · {s.solid}/{s.total} solides</span>
            <Bar value={s.solid} max={s.total || 1} />
          </div>
        ))}
      </div>
      <div className="grid g2">
        <div className="card stack">
          <h3>🧠 Révision du jour</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Les cartes qui arrivent à échéance + 20 nouvelles. Chaque carte revient juste avant que tu l'oublies : 1 jour, puis 3, puis 7… Les cartes d'actu reviennent au plus tard la veille du test.
          </p>
          <button className="btn primary big" onClick={() => start(daily(), "du jour")} disabled={daily().length === 0}>
            {daily().length ? `▶ Commencer (${daily().length} cartes)` : "Tout est à jour 🎉"}
          </button>
        </div>
        <div className="card stack" style={eve ? { borderColor: "var(--gold)" } : undefined}>
          <h3>🌙 Spécial veille de test</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Toute l'actu de la semaine + les 30 cartes de personnages et de mots les moins solides, mélangées. À faire le jeudi soir, en plus de la révision du jour.
          </p>
          <button className={`btn big ${eve ? "gold" : ""}`} onClick={() => start(eveQueue(), "veille de test")}>▶ Lancer ({eveQueue().length} cartes)</button>
        </div>
      </div>
      <div className="card">
        <h3>Réviser une catégorie</h3>
        <div className="row">
          <button className="btn" onClick={() => start(shuffle(cards.filter((c) => c.deck === "bio")), "personnages")}>👤 Tous les personnages</button>
          <button className="btn" onClick={() => start(shuffle(cards.filter((c) => c.deck === "mot")), "mots")}>📖 Tous les mots</button>
          <button className="btn" onClick={() => start(shuffle(cards.filter((c) => c.deck === "actu" && (!c.date || +new Date(c.date) >= +actuWeekStart() - 864e5))), "actu de la semaine")}>🗞️ Actu de la semaine</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Fiches

function SheetsTab() {
  const allSheets = useStore((s) => s.sheets);
  const fallen = useStore((s) => s.fallen);
  const toggleFallen = useStore((s) => s.toggleFallen);
  const sheets = useMemo(() => allSheets.filter((x) => !fallen.includes(x.id)), [allSheets, fallen]);
  const gone = allSheets.filter((x) => fallen.includes(x.id));
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const [open, setOpen] = useState<Sheet | null>(null);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const byWeek = useMemo(() => {
    const m = new Map<string, Sheet[]>();
    for (const s of [...sheets].sort((a, b) => b.sentAt.localeCompare(a.sentAt) || a.id.localeCompare(b.id))) {
      if (!m.has(s.sentAt)) m.set(s.sentAt, []);
      m.get(s.sentAt)!.push(s);
    }
    return [...m.entries()];
  }, [sheets]);
  const mastery = (id: string) => {
    const cs = cards.filter((c) => c.ref === id);
    return cs.length ? cs.filter((c) => (reviews[c.id]?.interval ?? 0) >= 3).length / cs.length : 0;
  };

  if (queue)
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <ReviewSession queue={queue} title="fiche" onDone={() => setQueue(null)} />
      </div>
    );

  return (
    <>
      <div className="stack" style={{ gap: 16 }}>
        {byWeek.map(([date, list]) => (
          <div key={date}>
            <div className="small muted" style={{ marginBottom: 6 }}>Envoyé le {fmtDay(date)}</div>
            <div className="grid g3">
              {list.map((s) => (
                <button key={s.id} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setOpen(s)}>
                  <div className="row between">
                    <span className={`pill ${s.kind === "bio" ? "purple" : "blue"}`}>{s.kind === "bio" ? "👤 Personnage" : "📖 Mot"} {s.id}</span>
                    <span className="small muted">{Math.round(mastery(s.id) * 100)} %</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 17, margin: "8px 0" }}>{s.title}</div>
                  <Bar value={mastery(s.id)} max={1} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {sheets.length === 0 && <div className="card empty">Aucune fiche pour l'instant.</div>}
        {gone.length > 0 && (
          <div className="card">
            <h3>✅ Déjà tombés au test <span className="right small muted">le prof ne les redonne pas : ils sont retirés des révisions et du tirage</span></h3>
            <div className="row">
              {gone.map((s) => (
                <span key={s.id} className="pill">
                  {s.id} · {s.title}
                  <button className="btn sm ghost" style={{ padding: "0 4px" }} title="Remettre dans les révisions" onClick={() => toggleFallen(s.id)}>↩︎</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {open && (
        <Modal
          title={`${open.id} · ${open.title}`}
          onClose={() => setOpen(null)}
          actions={
            <>
              <button className="btn" onClick={() => { toggleFallen(open.id); setOpen(null); }}>✅ Déjà tombé au test</button>
              <span className="spacer" />
              <button className="btn" onClick={() => setOpen(null)}>Fermer</button>
              <button className="btn primary" onClick={() => { setQueue(cards.filter((c) => c.ref === open.id)); setOpen(null); }}>🧠 Réviser cette fiche</button>
            </>
          }
        >
          <div className="sheet-body">{open.body}</div>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Tirage blanc

type Grading = { note: number; trouves: string[]; oublis: string[]; erreurs: string[]; conseil: string };

function BlankTab() {
  const allSheets = useStore((s) => s.sheets);
  const fallen = useStore((s) => s.fallen);
  const sheets = allSheets.filter((x) => !fallen.includes(x.id));
  const aiOk = useAi((s) => s.available);
  const [draw, setDraw] = useState<Sheet[] | null>(null);
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState<Grading | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState(false);
  const clock = useSessionClock();

  const pick = (kind?: "bio" | "mot") => {
    const bios = sheets.filter((s) => s.kind === "bio");
    const mots = sheets.filter((s) => s.kind === "mot");
    const k = kind ?? (Math.random() < 0.5 ? "bio" : "mot");
    setDraw(k === "bio" ? shuffle(bios).slice(0, 1) : shuffle(mots).slice(0, 2));
    setAnswer("");
    setGrading(null);
    setReveal(false);
    setError("");
    clock.reset();
  };

  const grade = async () => {
    if (!draw) return;
    setBusy(true);
    setError("");
    try {
      const ref = draw.map((s) => `### ${s.title}\n${s.body}`).join("\n\n");
      const g = await askJson<Grading>(
        `Tu es professeur de culture générale en classe préparatoire. L'élève devait écrire de mémoire ${draw[0].kind === "bio" ? `ce qu'il sait du personnage « ${draw[0].title} »` : `la définition (et si possible l'étymologie) des mots « ${draw.map((s) => s.title).join(" » et « ")} »`}.
Voici la fiche de référence du professeur :
${ref}

Voici la réponse de l'élève :
"""${answer}"""

Corrige en comparant UNIQUEMENT avec la fiche. Sois exigeant mais juste : une date ou un nom approximatif est une erreur.
Réponds en JSON : {"note": nombre sur 10 (demi-points autorisés), "trouves": [points clés correctement restitués], "oublis": [points importants de la fiche absents], "erreurs": [affirmations fausses ou imprécises], "conseil": "une phrase pour mieux retenir"}. Rédige en français.`,
        { tier: "default", fresh: true },
      );
      setGrading(g);
      clock.log("Culture générale", `Tirage blanc ${draw.map((s) => s.title).join(", ")} : ${g.note}/10`);
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid g2">
      <div className="card stack">
        <h3>🎲 Tirage comme le prof</h3>
        <p className="small muted" style={{ margin: 0 }}>
          L'appli tire au sort un personnage ou deux mots parmi toutes les fiches depuis la rentrée. Écris tout ce que tu sais, sans regarder, puis fais-toi corriger.
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => pick()}>🎲 Tirage au sort</button>
          <button className="btn" onClick={() => pick("bio")}>👤 Un personnage</button>
          <button className="btn" onClick={() => pick("mot")}>📖 Deux mots</button>
        </div>
        {draw && (
          <>
            <div className="flash-front" style={{ marginTop: 8 }}>
              {draw[0].kind === "bio" ? `Écrivez ce que vous savez de ${draw[0].title}.` : `Définissez : ${draw.map((s) => s.title).join(" et ")}.`}
            </div>
            <textarea id="blank-answer" className="input" rows={10} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ta réponse de mémoire…" />
            <div className="row">
              <button className="btn primary" disabled={busy || answer.trim().length < 10 || aiOk === false} onClick={grade}>
                {busy ? "Correction…" : "✍️ Corriger avec Claude"}
              </button>
              <button className="btn" onClick={() => setReveal(!reveal)}>{reveal ? "Masquer la fiche" : "📄 Voir la fiche"}</button>
            </div>
            {aiOk === false && <div className="small muted">La correction par Claude marche dans la version claude.ai. Ici, compare avec la fiche.</div>}
            {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
          </>
        )}
      </div>
      <div className="stack">
        {grading && (
          <div className="card stack">
            <h3>Correction <span className="right"><span className={`pill ${grading.note >= 8 ? "green" : grading.note >= 5 ? "gold" : "red"}`} style={{ fontSize: 15 }}>{grading.note}/10</span></span></h3>
            {grading.trouves.length > 0 && <div><b style={{ color: "var(--accent)" }}>✓ Bien restitué</b><ul className="small">{grading.trouves.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {grading.oublis.length > 0 && <div><b style={{ color: "var(--gold)" }}>○ Oublié</b><ul className="small">{grading.oublis.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {grading.erreurs.length > 0 && <div><b style={{ color: "var(--red)" }}>✗ Erreurs</b><ul className="small">{grading.erreurs.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            <div className="small">💡 {grading.conseil}</div>
          </div>
        )}
        {reveal && draw && draw.map((s) => <div key={s.id} className="card"><h3>{s.id} · {s.title}</h3><div className="sheet-body small">{s.body}</div></div>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Actu

function ActuTab() {
  const actuDays = useStore((s) => s.actuDays);
  const cards = useStore((s) => s.cards);
  const reviews = useStore((s) => s.reviews);
  const deleteCard = useStore((s) => s.deleteCard);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const ws = isoDay(actuWeekStart());
  const days = [...actuDays].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row between">
        <div className="small" style={{ flex: 1, minWidth: 220 }}>
          Colle ton document « Actu du jour » : Claude en tire des questions dans le style de ton prof. Une fois la tâche automatique activée, les nouveaux jours arrivent ici tout seuls chaque soir.
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Ajouter une journée</button>
      </div>
      {days.map((d) => {
        const qs = cards.filter((c) => c.deck === "actu" && c.date === d.id);
        const solid = qs.filter((c) => (reviews[c.id]?.interval ?? 0) >= 3).length;
        return (
          <div key={d.id} className="card">
            <div className="row between" style={{ cursor: "pointer" }} onClick={() => setOpen(open === d.id ? null : d.id)}>
              <div>
                <b>{d.title}</b> {d.id >= ws ? <span className="pill green">semaine du test</span> : <span className="pill">archive</span>}
              </div>
              <span className="small muted">{qs.length} questions · {solid} solides {open === d.id ? "▲" : "▼"}</span>
            </div>
            {open === d.id && (
              <div className="list" style={{ marginTop: 10 }}>
                {qs.map((c) => (
                  <div key={c.id} className="item">
                    <div className="body">
                      <div className="title">{c.front}</div>
                      <div className="small muted">{c.back}</div>
                    </div>
                    <button className="btn sm ghost" onClick={async () => (await ask("Supprimer cette question ?", { okLabel: "Supprimer", danger: true })) && deleteCard(c.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {adding && <AddActuDay onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddActuDay({ onClose }: { onClose: () => void }) {
  const mergePack = useStore((s) => s.mergePack);
  const toast = useStore((s) => s.toast);
  const [date, setDate] = useState(isoDay(new Date()));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await askJson<{ questions: Array<{ q: string; a: string }> }>(
        `Voici le résumé de l'actualité du ${date} (source : Le Monde) :
"""${text}"""

${PROF_STYLE}

Rédige 6 à 8 questions courtes et précises dans ce style (noms propres, fonctions, pays, chiffres marquants), une par événement important, avec une réponse courte et exacte tirée UNIQUEMENT du texte.
Réponds en JSON : {"questions": [{"q": "...", "a": "..."}]}`,
        { fresh: true },
      );
      const n = mergePack({
        id: `manual-${date}-${Date.now()}`,
        actuDays: [{ id: date, title: `Actu du jour — ${fmtDay(date)}` }],
        cards: r.questions.map((x, i) => ({ id: `actu-${date}-m${Date.now()}-${i}`, deck: "actu", date, ref: date, front: x.q, back: x.a })),
      });
      toast({ title: "🗞️ Questions ajoutées", body: `${n} nouvelles cartes`, tone: "good" });
      onClose();
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Ajouter une journée d'actu" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || text.trim().length < 40} onClick={go}>{busy ? "Claude prépare les questions…" : "Générer les questions"}</button></>}>
      <div className="stack">
        <Field label="Date"><input id="actu-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Texte (copie ton document Actu du jour)"><textarea id="actu-text" className="input" rows={10} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Résultats

function ResultsTab() {
  const tests = useStore((s) => s.cgTests);
  const addCgTest = useStore((s) => s.addCgTest);
  const deleteCgTest = useStore((s) => s.deleteCgTest);
  const sheets = useStore((s) => s.sheets);
  const fallen = useStore((s) => s.fallen);
  const toggleFallen = useStore((s) => s.toggleFallen);
  const [tombes, setTombes] = useState<string[]>([]);
  const candidates = sheets.filter((x) => !fallen.includes(x.id) && !tombes.includes(x.id)).sort((a, b) => a.id.localeCompare(b.id));
  const [score, setScore] = useState<number>(7);
  const [outOf, setOutOf] = useState<number>(10);
  // par défaut : aujourd'hui si on est vendredi, sinon le vendredi précédent
  const [date, setDate] = useState(isoDay(new Date().getDay() === 5 ? new Date() : addDays(nextTestDay(), -7)));
  const [note, setNote] = useState("");
  const sorted = [...tests].sort((a, b) => a.date.localeCompare(b.date));
  const avg = sorted.length ? sorted.reduce((a, t) => a + (t.score / t.outOf) * 10, 0) / sorted.length : NaN;

  return (
    <div className="grid g2">
      <div className="card stack">
        <h3>📝 Entrer ma note</h3>
        <div className="form-grid">
          <Field label="Date du test"><input id="cg-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note"><input id="cg-score" className="input" type="number" step={0.5} min={0} value={score} onChange={(e) => setScore(Number(e.target.value))} /></Field>
          <Field label="Sur"><input id="cg-outof" className="input" type="number" min={1} value={outOf} onChange={(e) => setOutOf(Number(e.target.value))} /></Field>
        </div>
        <Field label="Commentaire (ce qui est tombé, ce qui a coincé)"><input id="cg-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : bio de Machiavel, raté la question sur la CPI" /></Field>
        <Field label="Ce qui est tombé (sera retiré des révisions)">
          <select id="cg-fallen" className="input" value="" onChange={(e) => e.target.value && setTombes([...tombes, e.target.value])}>
            <option value="">+ Choisir le personnage ou les mots tombés</option>
            {candidates.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title}</option>)}
          </select>
        </Field>
        {tombes.length > 0 && (
          <div className="row">
            {tombes.map((id) => (
              <span key={id} className="pill gold">{id} · {sheets.find((x) => x.id === id)?.title}
                <button className="btn sm ghost" style={{ padding: "0 4px" }} onClick={() => setTombes(tombes.filter((t) => t !== id))}>✕</button>
              </span>
            ))}
          </div>
        )}
        <button className="btn primary" onClick={() => {
          const names = tombes.map((id) => sheets.find((x) => x.id === id)?.title).filter(Boolean).join(", ");
          addCgTest({ date, score, outOf, note: [names && `Tombé : ${names}`, note].filter(Boolean).join(" · ") || undefined });
          tombes.forEach((id) => toggleFallen(id));
          setTombes([]); setNote("");
        }}>Enregistrer</button>
        <p className="small muted" style={{ margin: 0 }}>Au-dessus de la moitié des points, ton club touche une prime.</p>
      </div>
      <div className="card">
        <h3>📈 Évolution <span className="right muted small">{Number.isNaN(avg) ? "" : `moyenne ${avg.toFixed(1)}/10`}</span></h3>
        {sorted.length === 0 ? (
          <div className="empty">Entre ta note de demain pour commencer la courbe. Tes deux 7/10 précédents peuvent aussi être ajoutés.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, marginBottom: 10 }}>
              {sorted.map((t) => {
                const v = (t.score / t.outOf) * 10;
                return (
                  <div key={t.id} title={`${fmtDay(t.date)} : ${t.score}/${t.outOf}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span className="small"><b>{v.toFixed(1)}</b></span>
                    <div style={{ width: "100%", height: `${v * 10}%`, minHeight: 3, borderRadius: 6, background: v >= 8 ? "var(--accent)" : v >= 6 ? "var(--gold)" : "var(--red)" }} />
                    <span className="small muted">{fmtDay(t.date).split(" ")[1]}</span>
                  </div>
                );
              })}
            </div>
            <div className="list">
              {[...sorted].reverse().map((t) => (
                <div key={t.id} className="row between small">
                  <span>{fmtDay(t.date)} · <b>{t.score}/{t.outOf}</b> {t.note && <span className="muted">· {t.note}</span>}</span>
                  <button className="btn sm ghost" onClick={() => deleteCgTest(t.id)}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
