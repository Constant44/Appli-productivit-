import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { askJson, AiError, useAi } from "../lib/ai";
import { countWords, isoDay, uid } from "../lib/utils";
import { Field } from "./ui";
import { navigate } from "../App";

type Feedback = {
  note: number;
  resume: string;
  criteres: Array<{ nom: string; note: number; sur: number; commentaire: string }>;
  points_forts: string[];
  a_corriger: string[];
  reformulations: Array<{ avant: string; apres: string }>;
  conseil_prioritaire: string;
};

type Draft = { sujetId: string; theme: string; title: string; text: string; dossier: string; startedAt?: number };
const KEY = "prepa-fc-synthese-brouillon";
const emptyDraft: Draft = { sujetId: "", theme: "", title: "", text: "", dossier: "" };
const loadDraft = (): Draft => {
  try {
    return { ...emptyDraft, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return emptyDraft;
  }
};

/** Entraîneur de synthèse : sujet, chrono 3h, compteur de mots, correction par Claude selon les critères du jury EDHEC. */
export function SyntheseTrainer() {
  const annales = useStore((s) => s.edhec.annales);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const startTimer = useStore((s) => s.startTimer);
  const timer = useStore((s) => s.timer);
  const ai = useAi((s) => s.available);
  const [d, setD] = useState<Draft>(loadDraft);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* brouillon non conservé (navigation privée) */
    }
  }, [d]);

  const sujets = annales.filter((a) => a.kind === "synthese").sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const sujet = sujets.find((a) => a.id === d.sujetId);
  const theme = sujet ? sujet.label.replace(/^Synthèse[^·]*·\s*/, "") : d.theme;
  const words = useMemo(() => countWords(d.text), [d.text]);
  const ok = words >= 450 && words <= 550;
  const minutes = d.startedAt ? Math.round((Date.now() - d.startedAt) / 60000) : undefined;
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const start = (min: number) => {
    set({ startedAt: Date.now() });
    if (timer.status === "idle") startTimer({ mode: "countdown", targetMin: min, subject: "EDHEC Synthèse" });
  };

  const correct = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await askJson<Feedback>(
        `Tu es correcteur de l'épreuve de synthèse de textes du concours EDHEC Pré-Master (3 h, coefficient 4).
Règles de l'épreuve : note de synthèse d'environ 500 mots (±10 %, soit 450 à 550), titre obligatoire, aucune opinion personnelle, aucune citation longue, toutes les idées viennent des documents, confrontées entre elles (pas un résumé document par document). Les rapports du jury évaluent : la logique du plan (problématique, 2 ou 3 parties équilibrées, progression), le choix et l'articulation des idées essentielles du dossier, l'expression et la correction de la langue, la présentation (titre, paragraphes, transitions).
Thème du dossier : ${theme || "non précisé"}.
${d.dossier.trim() ? `Idées / extraits du dossier fournis par le candidat (sers-t'en pour juger la fidélité et les oublis) :\n"""${d.dossier.slice(0, 12000)}"""` : "Le dossier n'est pas fourni : juge la fidélité seulement sur la cohérence interne, et dis-le."}
Copie (${words} mots selon le décompte EDHEC) :
Titre : ${d.title || "(aucun titre)"}
"""${d.text.slice(0, 8000)}"""

Corrige avec exigence, comme le jury, en français. Réponds en JSON :
{"note": note sur 20 (demi-points), "resume": "2 phrases de bilan", "criteres": [{"nom":"Plan et problématique","note":x,"sur":6,"commentaire":"…"},{"nom":"Choix et articulation des idées","note":x,"sur":6,"commentaire":"…"},{"nom":"Expression et langue","note":x,"sur":5,"commentaire":"…"},{"nom":"Présentation et respect des consignes","note":x,"sur":3,"commentaire":"…"}], "points_forts": ["…"], "a_corriger": ["… (précis, avec l'endroit de la copie)"], "reformulations": [{"avant":"phrase de la copie","apres":"version améliorée"}], "conseil_prioritaire": "la chose n°1 à travailler pour la prochaine synthèse"}
La somme des critères doit être égale à la note. 2 à 4 reformulations.`,
        { tier: "complex", fresh: true },
      );
      setFb(r);
    } catch (e) {
      setErr(e instanceof AiError ? e.message : "La correction a échoué, réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const feedback = fb ? `${fb.resume}\nÀ travailler : ${fb.conseil_prioritaire}` : undefined;
    updateEdhec((x) => ({
      ...x,
      syntheses: [...x.syntheses, { id: uid(), date: isoDay(new Date()), theme: theme || d.title || "Synthèse", note: fb?.note, words, minutes, feedback }],
      annales: sujet ? x.annales.map((a) => (a.id === sujet.id ? { ...a, done: true, score: fb?.note ?? a.score } : a)) : x.annales,
    }));
    setD(emptyDraft);
    setFb(null);
  };

  return (
    <div className="card stack" style={{ gridColumn: "1/-1" }}>
      <h3>✍️ Entraîneur de synthèse</h3>
      <div className="form-grid">
        <Field label="Sujet">
          <select className="input" value={d.sujetId} onChange={(e) => set({ sujetId: e.target.value })}>
            <option value="">Sujet libre (autre dossier)</option>
            {sujets.map((a) => <option key={a.id} value={a.id}>{a.done ? "✓ " : ""}{a.label}</option>)}
          </select>
        </Field>
        {!sujet && <Field label="Thème"><input className="input" value={d.theme} onChange={(e) => set({ theme: e.target.value })} placeholder="ex : la déconnexion numérique" /></Field>}
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {sujet?.links?.map((l) => <a key={l.url} className="btn sm ghost" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
        <button className="btn primary" disabled={timer.status !== "idle"} onClick={() => start(180)}>▶ Épreuve complète (3h)</button>
        <button className="btn" disabled={timer.status !== "idle"} onClick={() => start(90)}>Entraînement court (1h30)</button>
        {timer.status !== "idle" && timer.subject === "EDHEC Synthèse" && <button className="btn sm ghost" onClick={() => navigate("focus")}>⏱️ Voir le chrono</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Méthode conseillée sur 3h : 1h de lecture et de tableau de confrontation des idées, 30 min de plan, 1h15 de rédaction, 15 min de relecture et de décompte.
      </p>

      <Field label="Titre"><input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Un titre qui annonce la problématique" /></Field>
      <Field label={`Ta synthèse : ${words} mots ${ok ? "✓" : words < 450 ? "(trop court : 450 minimum)" : "(trop long : 550 maximum)"}`}>
        <textarea className="input" rows={14} value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="Introduction (accroche, présentation du dossier, problématique, annonce du plan), développement en 2 ou 3 parties, conclusion. Pas d'avis personnel." />
      </Field>
      <div className="row small" style={{ gap: 8 }}>
        <span className={`pill ${ok ? "green" : "gold"}`}>{words} / 500 mots</span>
        <span className="muted">Décompte EDHEC : l'élision compte à part (« l'État » = 2), un mot composé ou un sigle = 1.</span>
      </div>
      <details>
        <summary className="small" style={{ cursor: "pointer" }}>Idées clés du dossier (facultatif, pour une correction sur le fond)</summary>
        <textarea className="input" rows={5} style={{ marginTop: 6 }} value={d.dossier} onChange={(e) => set({ dossier: e.target.value })} placeholder="Colle ton tableau de confrontation ou les idées principales de chaque document." />
      </details>

      <div className="row">
        <button className="btn gold" disabled={!ai || busy || words < 100} onClick={correct}>{busy ? "Correction en cours…" : "🧑‍🏫 Corriger avec Claude"}</button>
        <button className="btn" disabled={words < 100} onClick={save}>Enregistrer{fb ? ` (${fb.note}/20)` : " sans correction"}</button>
        {ai === false && <span className="small muted">La correction par Claude marche dans la version claude.ai de l'appli.</span>}
      </div>
      {err && <div className="pill red" style={{ whiteSpace: "normal" }}>{err}</div>}

      {fb && (
        <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div className="row between"><b style={{ fontSize: 20 }}>{fb.note}/20</b><span className="small muted">{fb.resume}</span></div>
          <div className="list">
            {fb.criteres.map((c) => (
              <div key={c.nom} className="small"><b>{c.nom} : {c.note}/{c.sur}</b> · {c.commentaire}</div>
            ))}
          </div>
          {fb.points_forts.length > 0 && <div className="small"><b>👍 Points forts</b><ul>{fb.points_forts.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {fb.a_corriger.length > 0 && <div className="small"><b>🔧 À corriger</b><ul>{fb.a_corriger.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {fb.reformulations.length > 0 && (
            <div className="small"><b>✏️ Reformulations</b>
              {fb.reformulations.map((r, i) => <div key={i} style={{ marginTop: 6 }}><span className="muted" style={{ textDecoration: "line-through" }}>{r.avant}</span><br />→ {r.apres}</div>)}
            </div>
          )}
          <div className="reco"><span>🎯</span><div><b>Priorité pour la prochaine</b> : {fb.conseil_prioritaire}</div></div>
        </div>
      )}
    </div>
  );
}
