import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { subjectAverages } from "../lib/insights";
import { fmtDay, isoDay, subjectColor } from "../lib/utils";
import { Field, Modal, SubjectSelect } from "../components/ui";

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120, h = 32;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 20) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="#ffffff22" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export default function Grades() {
  const { grades, deleteGrade } = useStore();
  const [add, setAdd] = useState(false);
  const [period, setPeriod] = useState("");
  const periods = [...new Set(grades.map((g) => g.period).filter(Boolean))] as string[];
  const filtered = period ? grades.filter((g) => g.period === period || g.source === "manual") : grades;
  const { bySubject, overall } = useMemo(() => subjectAverages(filtered), [filtered]);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title">Notes</h1>
          <p className="page-sub">Notes Pronote + notes ajoutées à la main (khôlles, DS hors Pronote). Moyennes pondérées par coefficient, ramenées sur 20.</p>
        </div>
        <div className="row">
          {periods.length > 0 && (
            <select className="input" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="">Toutes périodes</option>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <button className="btn primary" onClick={() => setAdd(true)}>+ Note</button>
        </div>
      </div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card stat"><span className="v">{Number.isNaN(overall) ? "—" : overall.toFixed(2)}</span><span className="l">Moyenne générale (non pondérée par matière)</span></div>
        <div className="card stat"><span className="v">{filtered.length}</span><span className="l">notes</span></div>
        <div className="card stat">
          <span className="v">{bySubject.length ? [...bySubject].sort((a, b) => b.avg - a.avg)[0].subject : "—"}</span>
          <span className="l">Meilleure matière</span>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Moyennes par matière</h3>
          {bySubject.length === 0 && <div className="empty">Pas encore de notes.</div>}
          <div className="stack">
            {bySubject.map((s) => {
              const hist = filtered.filter((g) => g.subject === s.subject).sort((a, b) => a.date.localeCompare(b.date)).map((g) => (g.value / g.outOf) * 20);
              return (
                <div key={s.subject} className="row" style={{ flexWrap: "nowrap" }}>
                  <span className="dot" style={{ background: subjectColor(s.subject) }} />
                  <span style={{ width: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subject}</span>
                  <div style={{ flex: 1, position: "relative", height: 12, background: "var(--bg2)", borderRadius: 99 }}>
                    <div style={{ position: "absolute", inset: 0, width: `${(s.avg / 20) * 100}%`, background: s.avg >= overall ? "var(--accent)" : "var(--gold)", borderRadius: 99 }} />
                    <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "#fff6" }} />
                  </div>
                  <b style={{ width: 44, textAlign: "right" }}>{s.avg.toFixed(1)}</b>
                  <Sparkline values={hist} color={subjectColor(s.subject)} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h3>Dernières notes</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Matière</th><th>Intitulé</th><th className="num">Note</th><th className="num">Coef</th><th className="num">Classe</th><th /></tr></thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.id}>
                    <td>{fmtDay(g.date)}</td>
                    <td><span className="dot" style={{ background: subjectColor(g.subject) }} /> {g.subject}</td>
                    <td className="muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{g.label ?? ""}</td>
                    <td className="num"><b style={{ color: (g.value / g.outOf) * 20 >= 10 ? "var(--accent)" : "var(--red)" }}>{g.value}</b>/{g.outOf}</td>
                    <td className="num">{g.coefficient}</td>
                    <td className="num muted">{g.classAverage ?? "—"}</td>
                    <td>{g.source === "manual" ? <button className="btn sm ghost" onClick={() => deleteGrade(g.id)}>✕</button> : <span className="pill blue">PN</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {add && <AddGrade onClose={() => setAdd(false)} />}
    </>
  );
}

function AddGrade({ onClose }: { onClose: () => void }) {
  const { addGrade, settings } = useStore();
  const [g, setG] = useState({ subject: settings.subjects[0] ?? "Maths", value: 12, outOf: 20, coefficient: 1, date: isoDay(new Date()), label: "Khôlle" });
  return (
    <Modal title="Ajouter une note" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={() => { addGrade({ ...g, date: new Date(g.date).toISOString() }); onClose(); }}>Ajouter</button></>}>
      <div className="form-grid">
        <Field label="Matière"><SubjectSelect value={g.subject} onChange={(v) => setG({ ...g, subject: v })} /></Field>
        <Field label="Intitulé"><input className="input" value={g.label} onChange={(e) => setG({ ...g, label: e.target.value })} /></Field>
        <Field label="Note"><input className="input" type="number" step={0.25} value={g.value} onChange={(e) => setG({ ...g, value: Number(e.target.value) })} /></Field>
        <Field label="Sur"><input className="input" type="number" value={g.outOf} onChange={(e) => setG({ ...g, outOf: Number(e.target.value) })} /></Field>
        <Field label="Coef"><input className="input" type="number" step={0.5} value={g.coefficient} onChange={(e) => setG({ ...g, coefficient: Number(e.target.value) })} /></Field>
        <Field label="Date"><input className="input" type="date" value={g.date} onChange={(e) => setG({ ...g, date: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
