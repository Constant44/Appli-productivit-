import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { DEFAULT_SUBJECT_COEFS, gradeSubjectOfEval, neededGrade, subjectAverages } from "../lib/insights";
import { fmtDay, isoDay, subjectColor } from "../lib/utils";
import { Field, Modal, SubjectSelect } from "../components/ui";

export default function Grades() {
  const { grades, deleteGrade, settings, updateSettings } = useStore();
  const [add, setAdd] = useState(false);
  const [period, setPeriod] = useState("");
  const periods = [...new Set(grades.map((g) => g.period).filter(Boolean))] as string[];
  const filtered = period ? grades.filter((g) => g.period === period || g.source === "manual") : grades;
  const coefs = settings.subjectCoefs ?? DEFAULT_SUBJECT_COEFS;
  const { bySubject, overall, classOverall } = useMemo(() => subjectAverages(filtered, coefs), [filtered, coefs]);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const who = useStore((st) => st.pronote.user);
  const appreciation = (avg: number, cls?: number) => {
    const base = avg >= 14 ? "Très bon travail" : avg >= 12 ? "Bon travail" : avg >= 10 ? "Ensemble correct" : avg >= 8 ? "Peut mieux faire" : "Il faut se reprendre";
    return cls != null && avg >= cls + 1 ? `${base}, au-dessus de la classe` : cls != null && avg <= cls - 1.5 ? `${base} · sous la classe` : base;
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <span className="eyebrow">Notes · calcul identique à Pronote</span>
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

      <div className="clipboard">
        <div className="clip" aria-hidden><span /></div>
        <div className="paper bulletin">
          <header className="bul-head">
            <div>
              <b>LYCÉE GUSTAVE EIFFEL</b>
              <span>Bordeaux · CPGE D2</span>
            </div>
            <div className="bul-title">
              <b>Bulletin provisoire</b>
              <span>{who?.name ?? "MARTINEZ Constant"} · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </header>
          {bySubject.length === 0 && <p className="hand">Pas encore de notes.</p>}
          <div className="bul-table" role="table">
            <div className="bul-row bul-th" role="row"><span>Matière</span><span>Coef</span><span>Élève</span><span>Classe</span><span className="bul-app">Appréciation</span></div>
            {bySubject.map((x) => (
              <div key={x.subject} className="bul-block">
                <div className="bul-row" role="row">
                  <span className="bul-subj"><i className="dot" style={{ background: subjectColor(x.subject) }} /> {x.subject}</span>
                  <span><input className="bul-coef" type="number" min={0} step={0.5} value={x.coef} aria-label={`Coefficient ${x.subject}`}
                    onChange={(e) => updateSettings({ subjectCoefs: { ...coefs, [x.subject]: Math.max(0, Number(e.target.value)) } })} /></span>
                  <span className={`bul-avg ${x.avg >= 10 ? "" : "low"}`}>{x.avg.toFixed(2)}</span>
                  <span className="bul-cls">{x.classAvg != null ? x.classAvg.toFixed(2) : "—"}</span>
                  <span className="bul-app hand">{appreciation(x.avg, x.classAvg)}</span>
                </div>
                {x.subs?.map((sub) => (
                  <div key={sub.subject} className="bul-row bul-sub" role="row">
                    <span>↳ {sub.subject.split(" › ")[1] ?? sub.subject}</span><span /><span>{sub.avg.toFixed(2)}</span><span>{sub.classAvg != null ? sub.classAvg.toFixed(2) : "—"}</span><span className="bul-app" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <footer className="bul-foot">
            <span>Moyenne générale</span>
            <b className="red-circle">{Number.isNaN(overall) ? "—" : overall.toFixed(2).replace(".", ",")}</b>
            <span className="muted-ink">{Number.isNaN(classOverall) ? "" : `classe ≈ ${classOverall.toFixed(2).replace(".", ",")}`}</span>
          </footer>
        </div>

        <div className="paper notes-sheet">
          <h3 className="sheet-title">Dernières notes</h3>
          <div className="grade-list">
            {sorted.map((g) => {
              const on20 = (g.value / g.outOf) * 20;
              const [main, sub] = g.subject.split(" › ");
              return (
                <div key={g.id} className="grade-row">
                  <span className="subject-bar" style={{ background: subjectColor(main) }} />
                  <div className="grade-info">
                    <div className="grade-subject">{main}{sub && <span className="muted-ink"> · {sub}</span>}</div>
                    <div className="small muted-ink">{fmtDay(g.date)}{g.label ? ` · ${g.label}` : ""} · coef {g.coefficient}{g.classAverage != null ? ` · classe ${g.classAverage}` : ""}</div>
                  </div>
                  <div className={`grade-value ${on20 >= 14 ? "great" : on20 >= 10 ? "ok" : "low"}`}>
                    <b>{g.value}</b><span>/{g.outOf}</span>
                  </div>
                  {g.source === "manual"
                    ? <button className="btn sm ghost" aria-label="Supprimer" onClick={() => deleteGrade(g.id)}>✕</button>
                    : <span className="pill blue" title="Importée de Pronote">PN</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!Number.isNaN(overall) && <TargetCard overall={overall} coefs={coefs} />}
      {add && <AddGrade onClose={() => setAdd(false)} />}
    </>
  );
}

/** Objectif de moyenne : la note à viser au prochain DS / à la prochaine khôlle de chaque matière. */
function TargetCard({ overall, coefs }: { overall: number; coefs: Record<string, number> }) {
  const grades = useStore((s) => s.grades);
  const evals = useStore((s) => s.evals);
  const [target, setTarget] = useState(() => Math.min(18, Math.ceil(overall * 2) / 2 + 1));
  const rows = useMemo(() => {
    const now = Date.now();
    const next = new Map<string, (typeof evals)[number]>();
    for (const e of [...evals].sort((a, b) => a.date.localeCompare(b.date))) {
      if (+new Date(e.date) < now) continue;
      const subj = gradeSubjectOfEval(e.subject);
      if (!(subj.split(" › ")[0] in coefs) || next.has(subj)) continue;
      next.set(subj, e);
    }
    return [...next.entries()].map(([subj, e]) => ({ subj, e, ...neededGrade(grades, subj, target, coefs) }))
      .sort((a, b) => a.e.date.localeCompare(b.e.date));
  }, [grades, evals, coefs, target]);
  // Même note partout : la moyenne générale est affine en cette note commune.
  const common = useMemo(() => {
    if (!rows.length) return NaN;
    const at = (v: number) => subjectAverages([...grades, ...rows.map((r, k) => ({ id: `_s${k}`, subject: r.subj, value: v, outOf: 20, coefficient: 1, date: "", source: "manual" as const }))], coefs).overall;
    const lo = at(0), hi = at(20);
    return hi === lo ? NaN : ((target - lo) / (hi - lo)) * 20;
  }, [rows, grades, coefs, target]);
  const de = (s: string) => (/^[aeiouyéèêàâîôûh]/i.test(s) ? `d'${s.toLowerCase()}` : `de ${s.toLowerCase()}`);
  return (
    <section className="card target-card">
      <h3>🎯 Objectif de moyenne</h3>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="target-avg" className="small">Je vise</label>
        <input id="target-avg" type="range" min={8} max={18} step={0.5} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        <b className="target-val">{target.toFixed(1).replace(".", ",")}</b>
        <span className="small muted">aujourd'hui : {overall.toFixed(2).replace(".", ",")}</span>
      </div>
      {!Number.isNaN(common) && (
        <p className="target-headline">
          {common <= 0 ? "Objectif déjà atteint, même avec 0 partout." : common > 20 ? `Hors de portée sur les ${rows.length} prochaines épreuves : il faudra plus de temps.` : <>Il te faut <b>{(Math.ceil(common * 4) / 4).toString().replace(".", ",")}/20</b> en moyenne sur tes {rows.length} prochaines épreuves.</>}
        </p>
      )}
      <p className="small muted" style={{ margin: "4px 0 10px" }}>Épreuve par épreuve, si tout le reste ne bouge pas (note /20, coef 1 : une estimation) :</p>
      <div className="target-list">
        {rows.length === 0 && <div className="empty">Aucune épreuve à venir dans une matière notée.</div>}
        {rows.map((r) => {
          const done = r.x <= 0, out = r.x > 20;
          return (
            <div key={r.subj} className="target-row">
              <span className="subject-bar" style={{ background: subjectColor(r.subj.split(" › ")[0]) }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title">{r.e.type} {de(r.e.subject)}</div>
                <div className="small muted">{fmtDay(r.e.date)} · compte en {r.subj.replace(" › ", " · ")}</div>
              </div>
              <b className={`target-need ${done ? "ok" : out ? "low" : r.x >= 14 ? "hard" : ""}`}>
                {done ? "acquis" : out ? "> 20" : `${(Math.ceil(r.x * 4) / 4).toString().replace(".", ",")}/20`}
              </b>
            </div>
          );
        })}
      </div>
      {rows.some((r) => r.x > 20) && <p className="small muted" style={{ marginBottom: 0 }}>« &gt; 20 » : une seule épreuve ne suffit pas, il faudra en enchaîner plusieurs bonnes.</p>}
    </section>
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
