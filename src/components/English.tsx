import { useState } from "react";
import { useStore } from "../lib/store";
import { askJson, AiError, useAi } from "../lib/ai";
import { isoDay, uid } from "../lib/utils";

type Q = { sentence: string; choices: string[]; answer: number; rule: string };

const THEMES = [
  "temps verbaux (present perfect, past simple, futur)", "prépositions", "faux-amis", "modaux", "articles et déterminants",
  "verbes à particule", "conditionnels et subjonctif", "pronoms relatifs", "comparatifs et superlatifs", "ordre des mots et inversion",
  "gérondif ou infinitif", "quantifieurs (much, many, few, little)", "voix passive", "discours indirect", "vocabulaire de la presse économique",
];

/** QCM d'anglais au format de l'écrit EDHEC (grammaire, vocabulaire, syntaxe ; 4 choix ; pas de points négatifs). */
export function EnglishQuiz({ count, onDone }: { count: number; onDone?: (score: number, total: number) => void }) {
  const updateEdhec = useStore((s) => s.updateEdhec);
  const addCards = useStore((s) => s.addCards);
  const ai = useAi((s) => s.available);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  const load = async () => {
    setBusy(true);
    setError("");
    const themes = [...THEMES].sort(() => Math.random() - 0.5).slice(0, 4).join(", ");
    try {
      const r = await askJson<{ questions: Q[] }>(
        `Crée ${count} questions de QCM d'anglais au format de l'épreuve écrite de LV1 du concours EDHEC (Pré-Master) : une phrase en anglais avec un trou (___), 4 propositions, une seule correcte, niveau B2-C1, pièges classiques des candidats français.
Varie les thèmes, en insistant sur : ${themes}. Phrases inspirées de la presse récente (économie, politique, société).
Réponds en JSON : {"questions": [{"sentence": "...___...", "choices": ["a","b","c","d"], "answer": index 0-3 de la bonne réponse, "rule": "explication de la règle en français, une ou deux phrases"}]}`,
        { fresh: true },
      );
      setQs(r.questions.filter((q) => q.choices?.length === 4).slice(0, count));
      setI(0); setScore(0); setPicked(null); setFinished(false);
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (k: number) => {
    if (picked !== null || !qs) return;
    setPicked(k);
    const q = qs[i];
    if (k === q.answer) setScore((s) => s + 1);
    else
      addCards([{
        id: `en-${uid()}`, deck: "anglais",
        front: `Complète : ${q.sentence}\n(${q.choices.join(" / ")})`,
        back: `${q.choices[q.answer]}\n${q.rule}`,
      }]);
  };

  const next = () => {
    if (!qs) return;
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null); return; }
    setFinished(true);
    updateEdhec((e) => ({ ...e, english: [...e.english, { date: isoDay(new Date()), score, total: qs.length }] }));
    onDone?.(score, qs.length);
  };

  if (ai === false) return <div className="empty">Le QCM est généré par Claude : ouvre la version claude.ai de l'appli.</div>;
  if (!qs || finished)
    return (
      <div className="stack" style={{ alignItems: "flex-start" }}>
        {finished && qs && (
          <div className="flash-front">Score : {score}/{qs.length} {score === qs.length ? "🏆" : ""}<div className="small muted" style={{ fontWeight: 400 }}>Tes erreurs sont devenues des cartes « Anglais » qui reviendront dans tes révisions.</div></div>
        )}
        <button className="btn primary big" disabled={busy} onClick={load}>{busy ? "Claude prépare tes questions…" : finished ? "▶ Nouveau QCM" : `▶ Lancer un QCM de ${count} questions`}</button>
        {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
    );

  const q = qs[i];
  return (
    <div className="stack">
      <div className="row between small"><span>Question {i + 1}/{qs.length}</span><span className="muted">{score} juste{score > 1 ? "s" : ""}</span></div>
      <div className="flash-front" style={{ fontSize: 18 }}>{q.sentence}</div>
      <div className="grid g2" style={{ gap: 8 }}>
        {q.choices.map((c, k) => (
          <button key={k} className={`btn choice ${picked !== null && k === q.answer ? "right" : ""} ${picked === k && k !== q.answer ? "wrong" : ""}`} onClick={() => choose(k)}>
            {String.fromCharCode(65 + k)}. {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <div className="sheet-body small">{picked === q.answer ? "✅ " : "❌ "}{q.rule}</div>
          <button className="btn primary" onClick={next}>{i + 1 < qs.length ? "Question suivante →" : "Terminer"}</button>
        </>
      )}
    </div>
  );
}

type Tr = { fr: string };
type TrGrade = { score: number; correction: string; remarques: string };

/** Traduction (thème) : 3 phrases de presse à traduire, corrigées par Claude (2 points chacune). */
export function Translation() {
  const ai = useAi((s) => s.available);
  const [items, setItems] = useState<Tr[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [grades, setGrades] = useState<TrGrade[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError(""); setGrades(null);
    try {
      const r = await askJson<{ sentences: string[] }>(
        `Donne 3 phrases en français, courtes et sorties de leur contexte, dans le style de la presse récente, à traduire en anglais (thème) comme à l'épreuve de LV1 de l'EDHEC. Chaque phrase contient une difficulté classique (temps, prépositions, tournures idiomatiques, faux-amis). Réponds en JSON : {"sentences": ["...", "...", "..."]}`,
        { fresh: true },
      );
      setItems(r.sentences.slice(0, 3).map((fr) => ({ fr })));
      setAnswers(["", "", ""]);
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };
  const grade = async () => {
    if (!items) return;
    setBusy(true); setError("");
    try {
      const r = await askJson<{ items: TrGrade[] }>(
        `Tu es correcteur de l'épreuve de LV1 anglais du concours EDHEC. Corrige ces traductions (thème) d'un élève, sur 2 points chacune (0, 0.5, 1, 1.5 ou 2), avec exigence sur la grammaire et l'idiomaticité.
${items.map((t, k) => `${k + 1}. Français : ${t.fr}\n   Élève : ${answers[k] || "(vide)"}`).join("\n")}
Réponds en JSON : {"items": [{"score": nombre, "correction": "une traduction modèle", "remarques": "erreurs précises et règle en français"}]}`,
        { fresh: true },
      );
      setGrades(r.items);
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (ai === false) return <div className="empty">La traduction est corrigée par Claude : ouvre la version claude.ai de l'appli.</div>;
  return (
    <div className="stack">
      {!items && <button className="btn primary" disabled={busy} onClick={load}>{busy ? "Claude prépare les phrases…" : "▶ 3 phrases à traduire"}</button>}
      {items?.map((t, k) => (
        <div key={k} className="stack" style={{ gap: 6 }}>
          <b>{k + 1}. {t.fr}</b>
          <textarea id={`tr-${k}`} className="input" rows={2} value={answers[k]} onChange={(e) => setAnswers(answers.map((a, j) => (j === k ? e.target.value : a)))} placeholder="Ta traduction" />
          {grades?.[k] && (
            <div className="sheet-body small">
              <b>{grades[k].score}/2</b> · ✅ {grades[k].correction}<br />{grades[k].remarques}
            </div>
          )}
        </div>
      ))}
      {items && (
        <div className="row">
          {!grades && <button className="btn primary" disabled={busy} onClick={grade}>{busy ? "Correction…" : "✍️ Corriger"}</button>}
          {grades && <span className="pill gold">Total : {grades.reduce((a, g) => a + g.score, 0)}/6</span>}
          <button className="btn" disabled={busy} onClick={load}>Nouvelles phrases</button>
        </div>
      )}
      {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
    </div>
  );
}
