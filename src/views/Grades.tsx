/** Dans le Bilan : notes Pronote (progressions, baisses) et analyse des copies corrigées (erreurs récurrentes). */
import { useMemo, useState } from "react";
import { addDays, fmtDM, today, type ISODate } from "../lib/dates";
import { errorTypesFor, fmt20, fmtNum, gradeInsights, gradesOfWeek, isUngraded, on20, recurringErrors, summarize, UNGRADED_LABEL, type Copy } from "../lib/grades";
import { uid } from "../lib/model";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { useCats } from "../components/common";

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted small">—</span>;
  const w = 92, h = 26, pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - (Math.max(0, Math.min(20, v)) / 20) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const up = values[values.length - 1] >= values[values.length - 2];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden>
      <line x1={pad} x2={w - pad} y1={y(10)} y2={y(10)} stroke="var(--line)" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.2" fill={up ? "var(--lime)" : "var(--danger)"} />
    </svg>
  );
}

const Delta = ({ d }: { d?: number }) =>
  d === undefined ? <span className="muted">—</span> : <span className={d > 0 ? "up" : d < 0 ? "down" : "muted"}>{d > 0 ? "▲ +" : d < 0 ? "▼ " : "= "}{fmtNum(d)}</span>;

export function GradesSection({ week }: { week: ISODate }) {
  const content = useStore((s) => s.content);
  const plan = useStore((s) => s.plan);
  const cats = useCats();
  const grades = useMemo(() => content.grades ?? [], [content.grades]);
  const sums = useMemo(() => summarize(grades), [grades]);
  const fresh = gradesOfWeek(grades, week);
  const lines = gradeInsights(sums, plan.copies, (id) => cats.get(id)?.name ?? id);

  return (
    <section className="card">
      <div className="row between wrap gap">
        <h3 className="h3">Notes (Pronote)</h3>
        {content.gradesAt && <span className="muted small">mises à jour le {fmtDM(content.gradesAt.slice(0, 10))}</span>}
      </div>
      {grades.length === 0 ? <p className="muted small">Les notes arrivent depuis Pronote chaque soir (import de Claude). Recharge l'appli demain matin.</p> : (
        <>
          {fresh.length > 0 && (
            <div className="new-grades">
              <span className="eyebrow">Cette semaine</span>
              {fresh.map((g) => (
                <span key={g.id} className="grade-chip">
                  <b>{fmt20(on20(g))}</b> {g.subject}{g.label ? ` · ${g.label}` : ""}
                  {g.classAverage !== undefined && <em className={on20(g) >= (g.classAverage / g.outOf) * 20 ? "up" : "down"}> classe {fmt20((g.classAverage / g.outOf) * 20)}</em>}
                </span>
              ))}
            </div>
          )}
          {lines.length > 0 && <ul className="insights">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
          <div className="table-wrap">
            <table className="rtable grades">
              <thead><tr><th>Matière</th><th>Moyenne</th><th>Dernière</th><th>Évolution</th><th>vs classe</th><th>Tendance</th></tr></thead>
              <tbody>
                {sums.map((s) => (
                  <tr key={s.subject}>
                    <td><span className="dot" style={{ background: cats.get(s.cat)?.color ?? "var(--muted)" }} />{s.subject} <span className="muted small">({s.count})</span></td>
                    <td className="num"><b>{fmtNum(s.avg)}</b> <Delta d={s.avgDelta} /></td>
                    <td className="num">{fmt20(on20(s.last))}<span className="muted small"> · {fmtDM(s.last.date.slice(0, 10))}</span></td>
                    <td className="num"><Delta d={s.delta} /></td>
                    <td className="num">{s.vsClass === undefined ? <span className="muted">—</span> : <Delta d={s.vsClass} />}</td>
                    <td><Spark values={s.trend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Notes ramenées sur 20. Évolution = dernière note par rapport à la précédente ; le petit chiffre à côté de la moyenne = effet de la dernière note sur la moyenne.</p>
        </>
      )}
    </section>
  );
}

export function CopiesSection() {
  const plan = useStore((s) => s.plan);
  const open = useUI((s) => s.open);
  const cats = useCats();
  const subjects = useMemo(() => {
    const base = ["micro", "anglais", "synthese"];
    for (const c of plan.copies) if (!base.includes(c.cat)) base.push(c.cat);
    return base;
  }, [plan.copies]);
  const tomorrow = addDays(today(), 1);

  return (
    <section className="card">
      <div className="row between wrap gap">
        <h3 className="h3">Analyse des copies</h3>
        <button className="btn sm primary" onClick={() => open({ kind: "copy" })}>+ Ajouter une copie corrigée</button>
      </div>
      <p className="muted small">Pour chaque DS ou khôlle corrigé : la note et le type de chaque erreur. La synthèse n'est pas notée (correction PGE-PGO) : on relève seulement les erreurs de la correction. Les erreurs qui reviennent te disent quoi travailler. Tu peux aussi m'envoyer la copie corrigée (photo ou PDF) : je fais l'analyse et elle arrive ici.</p>
      <div className="copies-grid">
        {subjects.map((cat) => {
          const c = cats.get(cat);
          const r = recurringErrors(plan.copies, cat);
          const list = plan.copies.filter((x) => x.cat === cat).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={cat} className="copy-col" style={{ ["--c" as string]: c?.color }}>
              <div className="copy-head"><span className="dot" style={{ background: c?.color }} /><b>{c?.name ?? cat}</b><span className="muted small">{list.length} copie{list.length > 1 ? "s" : ""}</span></div>
              {r.ranked.length > 0 ? (
                <ul className="err-rank">
                  {r.ranked.slice(0, 4).map((e, i) => (
                    <li key={e.type}>
                      <span className="err-bar"><span style={{ width: `${(e.n / r.copies) * 100}%` }} /></span>
                      <span className="err-type">{e.type}</span>
                      <span className="muted num">{e.n}/{r.copies}</span>
                      {i === 0 && e.n >= 2 && (
                        <button className="btn xs" onClick={() => open({ kind: "new", defaults: { date: tomorrow, cat, title: `${c?.name ?? cat} : travailler « ${e.type} »`, prio: "important", start: "14:00", end: "14:45" } })}>
                          Programmer une séance
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">Pas encore de copie analysée.</p>}
              <ul className="copy-list">
                {list.slice(0, 4).map((x) => (
                  <li key={x.id}>
                    <button onClick={() => open({ kind: "copy", id: x.id })}>
                      <span className={`copy-grade ${isUngraded(x) ? "corr" : ""}`}>{isUngraded(x) ? "corrigé" : x.grade !== undefined && x.outOf ? fmt20((x.grade / x.outOf) * 20) : "—"}</span>
                      <span className="copy-title">{x.title}<span className="muted small"> · {fmtDM(x.date)}</span></span>
                      <span className="copy-errs">{x.errors.slice(0, 3).map((e) => <em key={e.type}>{e.type}</em>)}{x.errors.length > 3 && <em>+{x.errors.length - 3}</em>}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button className="btn xs ghost" onClick={() => open({ kind: "copy", cat })}>+ Copie de {c?.name ?? cat}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Ajouter / modifier une copie corrigée. */
export function CopySheet({ id, cat }: { id?: string; cat?: string }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const close = useUI((s) => s.close);
  const existing = id ? plan.copies.find((c) => c.id === id) : undefined;
  const [c, setC] = useState<Copy>(existing ?? { id: uid(), date: today(), cat: cat ?? "micro", kind: cat === "synthese" ? "Synthèse" : "DS", title: "", errors: [], outOf: 20 });
  const [custom, setCustom] = useState("");
  const [del, setDel] = useState(false);
  const up = (p: Partial<Copy>) => setC((x) => ({ ...x, ...p }));
  const has = (t: string) => c.errors.some((e) => e.type === t);
  const toggle = (t: string) => up({ errors: has(t) ? c.errors.filter((e) => e.type !== t) : [...c.errors, { type: t }] });
  const types = [...new Set([...errorTypesFor(c.cat), ...c.errors.map((e) => e.type)])];
  const save = () => {
    const base = { ...c, title: c.title.trim() || `${c.kind} du ${fmtDM(c.date)}` };
    const copy: Copy = isUngraded(base) ? { ...base, grade: undefined, outOf: undefined } : base;
    apply((p) => ({ ...p, copies: existing ? p.copies.map((x) => (x.id === copy.id ? copy : x)) : [...p.copies, { ...copy, source: "app" }] }), existing ? "Copie mise à jour" : "Copie ajoutée à l'analyse");
    close();
  };
  return (
    <div className="sheet-body">
      <h2 className="sheet-title">{existing ? "Copie corrigée" : "Ajouter une copie corrigée"}</h2>
      <div className="grid2">
        <label className="field"><span>Intitulé</span><input id="cp-title" className="input" value={c.title} onChange={(e) => up({ title: e.target.value })} placeholder={isUngraded(c) ? "Synthèse devoir 1 (correction PGE-PGO)" : "DS 3 : oligopole…"} /></label>
        <label className="field"><span>Date</span><input id="cp-date" className="input" type="date" value={c.date} onChange={(e) => up({ date: e.target.value })} /></label>
      </div>
      <div className="field">
        <span>Matière</span>
        <div className="chips">
          {plan.categories.filter((x) => x.tracked && !["anki", "sport", "lecture", "actu"].includes(x.id)).map((x) => (
            <button type="button" key={x.id} className={`chip ${c.cat === x.id ? "on" : ""}`} style={{ ["--c" as string]: x.color }} onClick={() => up(x.id === "synthese" ? { cat: x.id, kind: "Synthèse" } : { cat: x.id, kind: c.kind === "Synthèse" ? "DS" : c.kind })}><span className="dot" style={{ background: x.color }} />{x.name}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <span>Type</span>
          <div className="seg">{(["DS", "Synthèse", "Khôlle", "Devoir", "Concours blanc"] as Copy["kind"][]).map((k) => <button type="button" key={k} className={c.kind === k ? "on" : ""} onClick={() => up({ kind: k })}>{k}</button>)}</div>
        </div>
        {isUngraded(c) ? (
          <div className="field">
            <span>Note</span>
            <p className="ungraded">{UNGRADED_LABEL}. Relève les erreurs signalées dans la correction : c'est ça qui compte.</p>
          </div>
        ) : (
        <div className="field">
          <span>Note</span>
          <div className="row gap">
            <input id="cp-grade" className="input sm" type="number" step={0.25} min={0} value={c.grade ?? ""} onChange={(e) => up({ grade: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <span className="muted">/</span>
            <input id="cp-out" className="input sm" type="number" min={1} value={c.outOf ?? 20} onChange={(e) => up({ outOf: Number(e.target.value) || 20 })} />
          </div>
        </div>
        )}
      </div>
      <div className="field">
        <span>Erreurs relevées dans la correction</span>
        <div className="err-pick">
          {types.map((t) => <button type="button" key={t} className={has(t) ? "on" : ""} onClick={() => toggle(t)}>{has(t) ? "✓ " : ""}{t}</button>)}
        </div>
        <div className="row gap">
          <input id="cp-custom" className="input" placeholder="Autre type d'erreur" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { e.preventDefault(); toggle(custom.trim()); setCustom(""); } }} />
          <button type="button" className="btn" disabled={!custom.trim()} onClick={() => { toggle(custom.trim()); setCustom(""); }}>Ajouter</button>
        </div>
        {c.errors.length > 0 && (
          <div className="err-notes">
            {c.errors.map((e, i) => (
              <label key={e.type} className="field"><span>{e.type} : détail (facultatif)</span>
                <input id={`cp-n-${i}`} className="input" value={e.note ?? ""} onChange={(ev) => up({ errors: c.errors.map((x) => (x.type === e.type ? { ...x, note: ev.target.value } : x)) })} placeholder="Ex. oublié la CSO pour vérifier le maximum" />
              </label>
            ))}
          </div>
        )}
      </div>
      <label className="field"><span>Ce que je change la prochaine fois</span><textarea id="cp-lessons" className="input" rows={2} value={c.lessons ?? ""} onChange={(e) => up({ lessons: e.target.value })} /></label>
      <div className="sheet-actions">
        {existing && !del && <button className="btn danger-ghost" onClick={() => setDel(true)}>Supprimer</button>}
        {del && <div className="confirm"><span>Supprimer cette copie ?</span><button className="btn danger" onClick={() => { apply((p) => ({ ...p, copies: p.copies.filter((x) => x.id !== c.id) }), "Copie supprimée"); close(); }}>Oui</button><button className="btn ghost" onClick={() => setDel(false)}>Non</button></div>}
        <span className="grow" />
        <button className="btn ghost" onClick={close}>Annuler</button>
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </div>
    </div>
  );
}
