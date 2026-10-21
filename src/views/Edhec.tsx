import { useMemo, useState } from "react";
import { EDHEC_SUBJECTS, useStore } from "../lib/store";
import { addDays, daysUntil, fmtDay, fmtMin, isoDay, startOfWeek, uid } from "../lib/utils";
import { Bar, Field, Seg } from "../components/ui";
import { EnglishQuiz, Translation } from "../components/English";
import { SyntheseTrainer } from "../components/Synthese";
import { ANNALE_KIND_LABEL, type Annale, type AnnaleKind } from "../lib/types";

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
      <ResourcesCard />
    </div>
  );
}

const LEVELS = ["Pas vu", "Vu en cours", "Exercices faits", "Maîtrisé"];
const LEVEL_COLORS = ["var(--bg2)", "var(--red)", "var(--gold)", "var(--accent)"];

function MicroTab() {
  const edhec = useStore((s) => s.edhec);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const [newCh, setNewCh] = useState("");
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Chapitres <span className="right small muted">{edhec.chapters.filter((c) => c.level === 3).length}/{edhec.chapters.length} maîtrisés</span></h3>
        <p className="small muted" style={{ marginTop: 0 }}>Table des matières du Hachon & Laurent. Clique sur les pastilles pour indiquer ton niveau.</p>
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
      <AnnalesCard kinds={["ens", "edhec-micro"]} hint="Coche quand tu l'as faite en conditions (3h) et note-toi avec le corrigé. Corrigés ENS 2013–2025 et EDHEC 2020–2025 aussi dans le livre de Bosco Menard (Ellipses, 2026)." />
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
      <SyntheseTrainer />
      <div className="card stack">
        <h3>📰 Synthèse faite ailleurs (papier, prépa)</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Objectif : environ une synthèse par semaine d'ici le concours, soit ~{target} de plus. Ta formule PGE-PGO n'en corrige que 2 : fais les autres dans l'entraîneur ci-dessus, corrigées par Claude.
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
              <span>{fmtDay(s.date)} · {s.theme}{s.words ? ` · ${s.words} mots` : ""}{s.feedback && <div className="muted" style={{ whiteSpace: "pre-line" }}>{s.feedback}</div>}</span>
              <span>{s.note != null ? <b>{s.note}/20</b> : <span className="muted">non notée</span>} <button className="btn sm ghost" onClick={() => updateEdhec((x) => ({ ...x, syntheses: x.syntheses.filter((y) => y.id !== s.id) }))}>✕</button></span>
            </div>
          ))}
        </div>
      </div>
      <AnnalesCard kinds={["synthese"]} hint="Sujets officiels avec le rapport du jury (pas de synthèse modèle). Depuis 2020, les textes viennent d'un numéro de Socialter." />
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
      <AnnalesCard kinds={["anglais"]} hint="Chaque PDF contient le sujet, le corrigé et le rapport du jury." />
    </div>
  );
}

const RESOURCES = [
  { label: "Page officielle Pré-Master (toutes les annales)", url: "https://www.edhec.edu/fr/programmes/grande-ecole/admissions-et-financement/voies-admission/admission-pre-master" },
  { label: "Conseils microéconomie EDHEC", url: "https://drive.google.com/file/d/1EtgA40Kp2MFkS4nsmWLSsB9nTYTQocG7/view" },
  { label: "Conseils synthèse", url: "https://drive.google.com/file/d/11OUeWGbZAIaZSijculq9w-y_Yx_DW52Q/view" },
  { label: "Conseils anglais", url: "https://drive.google.com/file/d/1kZvPYLinG8nXYWBTp4Wr9SOFaCcTV1b6/view" },
  { label: "QCM anglais par thème (1–32)", url: "https://drive.google.com/file/d/1vzFA0SJ3ufbKpkERgkv2CwGxQVmDgiJs/view" },
  { label: "QCM anglais par thème (33–64)", url: "https://drive.google.com/file/d/1ooiTAPgRRWdg96goP4I5gHnO4Kut30Qr/view" },
  { label: "100 mots clés business English", url: "https://drive.google.com/file/d/1UMfZPzqKvmtwEVsFbcnMUGuMWtxe3LiX/view" },
  { label: "Oral EDHEC", url: "https://docs.google.com/document/d/10SuCQvWeMX00pd2MgjAg3oNtNWVqU29johTOmX_ze_o/edit" },
];

export function ResourcesCard() {
  return (
    <div className="card">
      <h3>Ressources</h3>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {RESOURCES.map((r) => <a key={r.url} className="btn sm ghost" href={r.url} target="_blank" rel="noreferrer">{r.label} ↗</a>)}
      </div>
    </div>
  );
}

/** Annales d'une ou plusieurs épreuves : avancement, note, liens vers sujet et corrigés. Les annales sans type sont rangées en micro. */
function AnnalesCard({ kinds, hint }: { kinds: AnnaleKind[]; hint: string }) {
  const all = useStore((s) => s.edhec.annales);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const [newAn, setNewAn] = useState("");
  const [showAll, setShowAll] = useState(false);
  const list = all.filter((a) => kinds.includes(a.kind ?? "ens")).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const done = list.filter((a) => a.done);
  const scored = done.filter((a) => a.score != null);
  const avg = scored.reduce((a, x) => a + (x.score ?? 0), 0) / (scored.length || 1);
  const shown = showAll ? list : list.filter((a) => !a.done).slice(0, 8);
  const patch = (id: string, p: Partial<Annale>) => updateEdhec((x) => ({ ...x, annales: x.annales.map((y) => (y.id === id ? { ...y, ...p } : y)) }));
  return (
    <div className="card">
      <h3>Annales · {kinds.map((k) => ANNALE_KIND_LABEL[k]).join(" + ")} <span className="right small muted">{done.length}/{list.length} faites{scored.length ? ` · moyenne ${avg.toFixed(1)}/20` : ""}</span></h3>
      <p className="small muted" style={{ marginTop: 0 }}>{hint}</p>
      <div className="list">
        {shown.map((a) => (
          <div key={a.id} className="item">
            <button className={`check ${a.done ? "on" : ""}`} onClick={() => patch(a.id, { done: !a.done })}>{a.done ? "✓" : ""}</button>
            <div className="body">
              <div className="title">{a.label}</div>
              {a.links && a.links.length > 0 && (
                <div className="row small" style={{ flexWrap: "wrap", gap: 8 }}>
                  {a.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
                </div>
              )}
            </div>
            <input className="input" style={{ width: 70 }} type="number" min={0} max={20} step={0.5} placeholder="/20" value={a.score ?? ""}
              onChange={(e) => patch(a.id, { score: e.target.value === "" ? undefined : Number(e.target.value), done: true })} />
          </div>
        ))}
      </div>
      {list.length > shown.length || showAll ? (
        <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>{showAll ? "Masquer les faites et les plus anciennes" : `Tout afficher (${list.length})`}</button>
      ) : null}
      <div className="row" style={{ marginTop: 10 }}>
        <input className="input" style={{ flex: 1 }} value={newAn} onChange={(e) => setNewAn(e.target.value)} placeholder="Ajouter une annale ou un sujet" />
        <button className="btn" disabled={!newAn.trim()} onClick={() => { updateEdhec((x) => ({ ...x, annales: [...x.annales, { id: uid(), label: newAn.trim(), done: false, kind: kinds[0] }] })); setNewAn(""); }}>Ajouter</button>
      </div>
    </div>
  );
}
