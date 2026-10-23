/** Programme quotidien : le travail du jour (et des jours suivants), et les DS / khôlles dont il manque le programme. */
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Evaluation, Task } from "../lib/types";
import { addDays, daysUntil, fmtDay, fmtMin, isoDay, subjectColor } from "../lib/utils";
import { CompleteTaskModal } from "./forms";
import { navigate, type View } from "../App";

const WD = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

export function ProgramCard() {
  const tasks = useStore((s) => s.tasks);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [week, setWeek] = useState(false);
  const today = isoDay(new Date());
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.plannedFor && t.plannedFor >= today) m.set(t.plannedFor, [...(m.get(t.plannedFor) ?? []), t]);
    return m;
  }, [tasks, today]);
  const todays = byDay.get(today) ?? [];
  const total = todays.reduce((a, t) => a + t.estimateMin, 0);
  const done = todays.filter((t) => t.done).reduce((a, t) => a + t.estimateMin, 0);
  const next = Array.from({ length: 7 }, (_, i) => isoDay(addDays(new Date(), i + 1)));

  return (
    <section className="card program-card" style={{ marginBottom: 16 }}>
      <h3>Programme du jour <span className="small muted right">{fmtMin(done)} / {fmtMin(total)}</span></h3>
      <div className="day-progress"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      {todays.length === 0 ? (
        <div className="empty">Rien de programmé aujourd'hui : repos ou avance sur ta to-do.</div>
      ) : (
        <div className="list">
          {todays.map((t) => (
            <div key={t.id} className={`todo ${t.done ? "done" : ""}`}>
              <button className={`check ${t.done ? "on" : ""}`} aria-label="Terminer" disabled={t.done} onClick={() => setCompleting(t)}>{t.done ? "✓" : ""}</button>
              <span className="subject-bar" style={{ background: subjectColor(t.subject) }} />
              <div style={{ flex: 1, minWidth: 0, cursor: t.link ? "pointer" : undefined }} onClick={() => t.link && navigate(t.link as View)}>
                <div className="title" style={{ textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? 0.6 : 1 }}>{t.title}</div>
                <div className="small muted">{t.subject} · {fmtMin(t.estimateMin)}{t.link ? " · ouvrir →" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setWeek(!week)}>{week ? "Masquer la semaine" : "Voir les 7 prochains jours ↓"}</button>
      {week && (
        <div className="program-week">
          {next.map((d) => {
            const l = byDay.get(d) ?? [];
            const dd = new Date(`${d}T12:00:00`);
            return (
              <div key={d} className="program-day">
                <div className="program-day-h"><b>{WD[dd.getDay()]} {dd.getDate()}/{dd.getMonth() + 1}</b><span>{fmtMin(l.reduce((a, t) => a + t.estimateMin, 0))}</span></div>
                {l.length === 0 ? <div className="small muted">Libre</div> : l.map((t) => (
                  <div key={t.id} className="small program-line"><span className="dot" style={{ background: subjectColor(t.subject) }} />{t.title} <span className="muted">· {fmtMin(t.estimateMin)}</span></div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>Recalculé chaque jour : ce qui n'est pas fait est replanifié, ce qui est fait est déduit.</p>
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </section>
  );
}

/** DS / khôlles des 3 prochaines semaines sans programme : on demande sur quoi ça porte. */
export function useEvalsToAsk(): Evaluation[] {
  const evals = useStore((s) => s.evals);
  return useMemo(
    () => evals.filter((e) => !e.topic && +new Date(e.date) > Date.now() && daysUntil(e.date) <= 21).sort((a, b) => a.date.localeCompare(b.date)),
    [evals],
  );
}

export function TopicAsk({ ev, compact }: { ev: Evaluation; compact?: boolean }) {
  const updateEval = useStore((s) => s.updateEval);
  const [v, setV] = useState("");
  const d = daysUntil(ev.date);
  const save = () => { if (v.trim()) updateEval(ev.id, { topic: v.trim() }); };
  return (
    <div className={`topic-ask ${compact ? "compact" : ""}`}>
      {!compact && <div className="small"><b>{ev.type} de {ev.subject}</b> · {fmtDay(ev.date)} · {d <= 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} j`}</div>}
      {ev.hint && <div className="small muted">Piste : {ev.hint}</div>}
      <form className="row" style={{ gap: 6, marginTop: 4 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input className="input" placeholder="Sur quoi ça porte ?" value={v} onChange={(e) => setV(e.target.value)} />
        {ev.hint && !v && <button type="button" className="btn sm ghost" onClick={() => updateEval(ev.id, { topic: ev.hint })}>C'est ça</button>}
        <button className="btn sm gold" disabled={!v.trim()}>OK</button>
      </form>
    </div>
  );
}

export function AskTopicsCard() {
  const list = useEvalsToAsk();
  if (!list.length) return null;
  return (
    <section className="card ask-card" style={{ marginBottom: 16 }}>
      <h3>❓ Sur quoi portent-ils ?</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Dis-moi le programme : la préparation du programme quotidien s'adapte tout de suite.</p>
      <div className="stack">{list.slice(0, 4).map((e) => <TopicAsk key={e.id} ev={e} />)}</div>
    </section>
  );
}
