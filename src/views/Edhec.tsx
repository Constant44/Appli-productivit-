import { useMemo, useState } from "react";
import { EDHEC_SUBJECTS, useStore } from "../lib/store";
import { addDays, daysUntil, fmtDay, fmtMin, isoDay, startOfWeek, uid } from "../lib/utils";
import { Bar, Field, Seg } from "../components/ui";
import { EnglishQuiz, Translation } from "../components/English";

export const EDHEC_DATE = "2027-04-03";

const EPREUVES = [
  { name: "Option économie (microéconomie)", dur: "3h", coef: 5, detail: "Programme ENS D2 · annales ENS de micro · Hachon & Laurent (cours + exercices)" },
  { name: "Synthèse de textes", dur: "3h", coef: 4, detail: "Dossier de presse (≤ 6 textes), ~500 mots ±10 %, titre, barre tous les 50 mots, aucun avis personnel" },
  { name: "LV1 anglais", dur: "2h", coef: 3, detail: "15 phrases à traduire (thème ou version) + 50 QCM, sans dictionnaire, pas de points négatifs" },
];

export const PHASES = [
  { from: "2026-10-01", to: "2026-12-20", name: "Fondations", target: 0.3, goals: ["Méthode de synthèse, 1 synthèse toutes les 2 semaines", "QCM d'anglais 15 min/jour (échauffement)", "Chapitres de micro avec le cours + 1 annale ENS par quinzaine"] },
  { from: "2026-12-21", to: "2027-02-28", name: "Montée en charge (jusqu'au stage PGE-PGO)", target: 0.5, goals: ["1 synthèse chronométrée par semaine", "1 annale ENS de micro par semaine", "QCM + traduction chaque jour", "Stage Booster pendant les vacances de février"] },
  { from: "2027-03-01", to: "2027-03-27", name: "Concours blancs", target: 0.8, goals: ["Un samedi sur deux : les 3 épreuves enchaînées dans les vrais horaires", "Retravailler les erreurs récurrentes"] },
  { from: "2027-03-28", to: "2027-04-03", name: "Dernière ligne droite", target: 0.6, goals: ["On allège : fiches, carnet d'erreurs d'anglais, sommeil", "Samedi 3 avril : écrit EDHEC"] },
];

export const currentPhase = (now = new Date()) => PHASES.find((p) => isoDay(now) >= p.from && isoDay(now) <= p.to) ?? PHASES[0];

type Tab = "plan" | "micro" | "synthese" | "anglais";

export default function Edhec() {
  const [tab, setTab] = useState<Tab>("plan");
  const j = daysUntil(EDHEC_DATE);
  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Objectif EDHEC</h1>
          <p className="page-sub">Concours Pré-Master · écrits le <b>samedi 3 avril 2027</b> · 105 places pour les D1/D2</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[["plan", "🗺️ Plan"], ["micro", "📐 Micro"], ["synthese", "📰 Synthèse"], ["anglais", "🇬🇧 Anglais"]]} />
      </div>
      <div className="hero row between" style={{ marginBottom: 16 }}>
        <div>
          <div className="countdown">J-{j}</div>
          <div className="small muted">{Math.floor(j / 7)} semaines et {j % 7} jours · phase actuelle : <b style={{ color: "var(--text)" }}>{currentPhase().name}</b></div>
        </div>
        <WeekSplit />
      </div>
      {tab === "plan" && <PlanTab />}
      {tab === "micro" && <MicroTab />}
      {tab === "synthese" && <SyntheseTab />}
      {tab === "anglais" && <AnglaisTab />}
    </>
  );
}

function WeekSplit() {
  const sessions = useStore((s) => s.sessions);
  const { edhec, total } = useMemo(() => {
    const ws = startOfWeek(new Date()).toISOString();
    const week = sessions.filter((s) => s.start >= ws);
    return {
      edhec: week.filter((s) => EDHEC_SUBJECTS.includes(s.subject ?? "")).reduce((a, s) => a + s.minutes, 0),
      total: week.reduce((a, s) => a + s.minutes, 0),
    };
  }, [sessions]);
  const target = currentPhase().target;
  const share = total ? edhec / total : 0;
  return (
    <div style={{ minWidth: 240, flex: "0 1 320px" }}>
      <div className="row between small"><span>Part EDHEC cette semaine</span><b>{Math.round(share * 100)} % / cible {Math.round(target * 100)} %</b></div>
      <Bar value={share} max={1} tone={share >= target ? undefined : "gold"} />
      <div className="small muted">{fmtMin(edhec)} EDHEC sur {fmtMin(total)} · la micro compte aussi pour tes cours</div>
    </div>
  );
}

function PlanTab() {
  const now = isoDay(new Date());
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Les écrits (total des coefficients : 12)</h3>
        <div className="stack">
          {EPREUVES.map((e) => (
            <div key={e.name}>
              <div className="row between"><b>{e.name}</b><span className="pill gold">coef {e.coef} · {e.dur}</span></div>
              <Bar value={e.coef} max={12} tone="gold" />
              <div className="small muted">{Math.round((e.coef / 12) * 100)} % de l'écrit · {e.detail}</div>
            </div>
          ))}
        </div>
        <hr className="sep" />
        <p className="small" style={{ margin: 0 }}>
          <b>Répartir son temps.</b> On cherche à maximiser Σ cᵢ·fᵢ(tᵢ) sous la contrainte Σ tᵢ = T. À l'optimum, la dernière heure rapporte autant de points pondérés partout : <b>cᵢ·fᵢ′(tᵢ) = λ</b>. En pratique : l'anglais (coef 3) progresse vite au début, la micro (coef 5) sert aussi tes cours, et la synthèse (coef 4) ne progresse qu'avec la répétition.
        </p>
        <p className="small muted">Oraux (si admissible, fin mai à Lille) : Trilogie coef 6, anglais coef 2, LV2 facultative coef 1.</p>
      </div>
      <div className="card">
        <h3>Rétroplanning</h3>
        <div className="stack">
          {PHASES.map((p) => {
            const isNow = now >= p.from && now <= p.to;
            return (
              <div key={p.name} className={`phase ${isNow ? "now" : ""}`} style={{ opacity: now > p.to ? 0.5 : 1 }}>
                <div className="row between"><b>{p.name}</b><span className="small muted">{fmtDay(p.from)} → {fmtDay(p.to)}</span></div>
                <div className="small muted">Part EDHEC visée : {Math.round(p.target * 100)} % du temps de travail</div>
                <ul className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>{p.goals.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <p className="small muted">Pour que tes heures comptent ici, choisis la matière « Microéconomie », « EDHEC Synthèse » ou « EDHEC Anglais » quand tu lances une session.</p>
      </div>
    </div>
  );
}

const LEVELS = ["Pas vu", "Vu en cours", "Exercices faits", "Maîtrisé"];
const LEVEL_COLORS = ["var(--bg2)", "var(--red)", "var(--gold)", "var(--accent)"];

function MicroTab() {
  const edhec = useStore((s) => s.edhec);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const [newCh, setNewCh] = useState("");
  const [newAn, setNewAn] = useState("");
  const done = edhec.annales.filter((a) => a.done);
  const avg = done.filter((a) => a.score != null).reduce((a, x, _, arr) => a + (x.score ?? 0) / arr.length, 0);
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Chapitres <span className="right small muted">{edhec.chapters.filter((c) => c.level === 3).length}/{edhec.chapters.length} maîtrisés</span></h3>
        <p className="small muted" style={{ marginTop: 0 }}>Liste type : renomme-les selon la table des matières de ton Hachon & Laurent. Clique sur les pastilles pour indiquer ton niveau.</p>
        <div className="list">
          {edhec.chapters.map((c) => (
            <div key={c.id} className="item">
              <div className="body">
                <input className="input" style={{ background: "transparent", border: 0, padding: 0, fontWeight: 600 }} value={c.name}
                  onChange={(e) => updateEdhec((x) => ({ ...x, chapters: x.chapters.map((y) => (y.id === c.id ? { ...y, name: e.target.value } : y)) }))} />
                <div className="small muted">{LEVELS[c.level]}</div>
              </div>
              <span className="lvl-dots">
                {[1, 2, 3].map((l) => (
                  <button key={l} title={LEVELS[l]} style={{ background: c.level >= l ? LEVEL_COLORS[c.level] : undefined }}
                    onClick={() => updateEdhec((x) => ({ ...x, chapters: x.chapters.map((y) => (y.id === c.id ? { ...y, level: (y.level === l ? l - 1 : l) as 0 | 1 | 2 | 3 } : y)) }))} />
                ))}
              </span>
              <button className="btn sm ghost" onClick={() => updateEdhec((x) => ({ ...x, chapters: x.chapters.filter((y) => y.id !== c.id) }))}>✕</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input id="new-chapter" className="input" style={{ flex: 1 }} value={newCh} onChange={(e) => setNewCh(e.target.value)} placeholder="Ajouter un chapitre" />
          <button className="btn" disabled={!newCh.trim()} onClick={() => { updateEdhec((x) => ({ ...x, chapters: [...x.chapters, { id: uid(), name: newCh.trim(), level: 0 }] })); setNewCh(""); }}>Ajouter</button>
        </div>
      </div>
      <div className="card">
        <h3>Annales ENS de micro <span className="right small muted">{done.length}/{edhec.annales.length} faites{done.some((a) => a.score != null) ? ` · moyenne ${avg.toFixed(1)}/20` : ""}</span></h3>
        <p className="small muted" style={{ marginTop: 0 }}>Coche quand tu l'as faite en conditions (3h) et note-toi avec le corrigé.</p>
        <div className="list">
          {edhec.annales.map((a) => (
            <div key={a.id} className={`item ${a.done ? "" : ""}`}>
              <button className={`check ${a.done ? "on" : ""}`} onClick={() => updateEdhec((x) => ({ ...x, annales: x.annales.map((y) => (y.id === a.id ? { ...y, done: !y.done } : y)) }))}>{a.done ? "✓" : ""}</button>
              <div className="body"><div className="title">{a.label}</div></div>
              <input className="input" style={{ width: 80 }} type="number" min={0} max={20} step={0.5} placeholder="/20" value={a.score ?? ""}
                onChange={(e) => updateEdhec((x) => ({ ...x, annales: x.annales.map((y) => (y.id === a.id ? { ...y, score: e.target.value === "" ? undefined : Number(e.target.value), done: true } : y)) }))} />
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input id="new-annale" className="input" style={{ flex: 1 }} value={newAn} onChange={(e) => setNewAn(e.target.value)} placeholder="Ajouter (ex : Annale EDHEC 2025 économie)" />
          <button className="btn" disabled={!newAn.trim()} onClick={() => { updateEdhec((x) => ({ ...x, annales: [...x.annales, { id: uid(), label: newAn.trim(), done: false }] })); setNewAn(""); }}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

function SyntheseTab() {
  const edhec = useStore((s) => s.edhec);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const [theme, setTheme] = useState("");
  const [note, setNote] = useState<number | undefined>();
  const [date, setDate] = useState(isoDay(new Date()));
  const list = [...edhec.syntheses].sort((a, b) => b.date.localeCompare(a.date));
  const target = Math.ceil(daysUntil(EDHEC_DATE) / 7);
  return (
    <div className="grid g2">
      <div className="card stack">
        <h3>📰 Mes synthèses</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Objectif : environ une synthèse par semaine d'ici le concours, soit ~{target} de plus. Ta formule PGE-PGO n'en corrige que 2 : l'entraîneur de synthèse avec correction par Claude arrive à la prochaine étape.
        </p>
        <div className="form-grid">
          <Field label="Date"><input id="syn-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note /20 (si corrigée)"><input id="syn-note" className="input" type="number" min={0} max={20} step={0.5} value={note ?? ""} onChange={(e) => setNote(e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        </div>
        <Field label="Thème du dossier"><input id="syn-theme" className="input" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="ex : l'IA et le travail" /></Field>
        <button className="btn primary" disabled={!theme.trim()} onClick={() => { updateEdhec((x) => ({ ...x, syntheses: [...x.syntheses, { id: uid(), date, theme: theme.trim(), note }] })); setTheme(""); setNote(undefined); }}>Enregistrer</button>
      </div>
      <div className="card">
        <h3>Historique <span className="right small muted">{list.length} synthèse{list.length > 1 ? "s" : ""}</span></h3>
        {list.length === 0 && <div className="empty">Aucune synthèse pour l'instant.</div>}
        <div className="list">
          {list.map((s) => (
            <div key={s.id} className="row between small">
              <span>{fmtDay(s.date)} · {s.theme}</span>
              <span>{s.note != null ? <b>{s.note}/20</b> : <span className="muted">non notée</span>} <button className="btn sm ghost" onClick={() => updateEdhec((x) => ({ ...x, syntheses: x.syntheses.filter((y) => y.id !== s.id) }))}>✕</button></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnglaisTab() {
  const english = useStore((s) => s.edhec.english);
  const last = english.slice(-10);
  const pct = last.length ? last.reduce((a, r) => a + r.score / r.total, 0) / last.length : NaN;
  const since = addDays(new Date(), -7);
  const week = english.filter((r) => new Date(r.date) >= since).length;
  return (
    <div className="grid g2">
      <div className="card">
        <h3>🇬🇧 QCM format EDHEC <span className="right small muted">{Number.isNaN(pct) ? "" : `${Math.round(pct * 100)} % sur les 10 derniers · ${week} cette semaine`}</span></h3>
        <EnglishQuiz count={10} />
      </div>
      <div className="card">
        <h3>✍️ Traduction (thème)</h3>
        <Translation />
      </div>
    </div>
  );
}
