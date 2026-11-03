import { TopicAsk } from "../components/Program";
import { useState } from "react";
import { useStore } from "../lib/store";
import { resultBonus } from "../lib/game";
import type { Evaluation, Task } from "../lib/types";
import { daysUntil, fmtDay, fmtMin, fmtRelDay, fmtTime, isoDay, subjectColor } from "../lib/utils";
import { Bar, Modal, Seg } from "../components/ui";
import { EvalForm, TaskForm } from "../components/forms";
import { CAUSE_LABEL, DebriefModal } from "../components/DebriefModal";

export default function Evals() {
  const { evals, tasks } = useStore();
  const [edit, setEdit] = useState<Partial<Evaluation> | null>(null);
  const [editTask, setEditTask] = useState<Partial<Task> | null>(null);
  const [resultFor, setResultFor] = useState<Evaluation | null>(null);
  const [debriefFor, setDebriefFor] = useState<Evaluation | null>(null);
  const [tab, setTab] = useState<"next" | "past">("next");

  const upcoming = evals.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = evals.filter((e) => daysUntil(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
  const toGrade = past.filter((e) => e.result == null);
  const causes = past.flatMap((e) => (e.debrief ? [e.debrief.cause] : []));
  const causeCount = Object.entries(causes.reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title">DS & khôlles</h1>
          <p className="page-sub">Les DS détectés dans Pronote (cours marqués « devoir surveillé ») et les khôlles s'ajoutent ici. Entre ta note après coup pour toucher une prime.</p>
        </div>
        <button className="btn primary" onClick={() => setEdit({})}>+ Ajouter</button>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <Seg value={tab} onChange={setTab} options={[["next", `À venir (${upcoming.length})`], ["past", `Passés (${past.length})${toGrade.length ? ` · ${toGrade.length} à noter` : ""}`]]} />
      </div>

      {tab === "next" && (
        <div className="cork">
          {upcoming.length === 0 && <div className="pin-card" style={{ gridColumn: "1/-1" }}>Rien de prévu. Ajoute ton colloscope ici !</div>}
          {upcoming.map((e, idx) => {
            const prep = tasks.filter((t) => t.evalId === e.id && !t.program);
            const prog = tasks.filter((t) => t.program === `ev-${e.id}`);
            const progDone = prog.filter((t) => t.done).reduce((a, t) => a + t.estimateMin, 0);
            const progAll = prog.reduce((a, t) => a + t.estimateMin, 0);
            const done = prep.filter((t) => t.done).length;
            const d = daysUntil(e.date);
            return (
              <div key={e.id} className={`pin-card ${e.type === "DS" || e.type === "Concours blanc" ? "ds" : ""}`} style={{ ["--rot" as string]: `${((idx * 37) % 7) - 3}deg`, ["--pin" as string]: subjectColor(e.subject) }}>
                <div className="row between">
                  <span className={`pill ${e.type === "DS" || e.type === "Concours blanc" ? "red" : "purple"}`}>{e.type}</span>
                  <span className={`pill ${d <= 1 ? "gold" : ""}`}>{d === 0 ? "Aujourd'hui" : `J-${d}`}</span>
                </div>
                <h3 style={{ margin: "10px 0 4px", fontSize: 18 }}>{e.subject}</h3>
                <div className="small muted">{fmtDay(e.date)} · {fmtTime(e.date)}{e.durationMin ? ` · ${fmtMin(e.durationMin)}` : ""}{e.room ? ` · ${e.room}` : ""}</div>
                {e.examiner && <div className="small muted">👤 {e.examiner}</div>}
                {e.topic ? <div className="small" style={{ marginTop: 6 }}>📚 {e.topic}</div> : <TopicAsk ev={e} compact />}
                {e.source === "pronote" && <span className="pill blue" style={{ marginTop: 6 }}>Pronote</span>}
                <hr className="sep" />
                {progAll > 0 && <div className="row between small" style={{ marginBottom: 4 }}><span>Programme quotidien</span><b>{fmtMin(progDone)} / {fmtMin(progAll)}</b></div>}
                <div className="row between small"><span>Préparation</span><b>{done}/{prep.length}</b></div>
                <Bar value={done} max={prep.length || 1} tone="gold" />
                <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                  {prep.map((t) => (
                    <div key={t.id} className="small row" style={{ gap: 6 }}>
                      <span>{t.done ? "✅" : "⬜"}</span>
                      <span style={{ textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? 0.6 : 1 }}>{t.title}</span>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn sm gold" onClick={() => setEditTask({ evalId: e.id, subject: e.subject, kind: "revision", priority: d <= 3 ? 3 : 2, due: isoDay(e.date), title: "" })}>+ Tâche de prépa</button>
                  <button className="btn sm ghost" onClick={() => setEdit(e)}>Modifier</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "past" && (
        <div className="list">
          {causeCount.length > 0 && (
            <div className="card small">
              <b>Ce qui te coûte des points</b> (d'après tes debriefs) :{" "}
              {causeCount.map(([c, n]) => `${CAUSE_LABEL[c as keyof typeof CAUSE_LABEL]} ×${n}`).join(" · ")}
            </div>
          )}
          {past.length === 0 && <div className="card empty">Aucune éval passée.</div>}
          {past.map((e) => (
            <div key={e.id} className="item">
              <span className="subject-bar" style={{ background: subjectColor(e.subject) }} />
              <div className="body">
                <div className="title">{e.type} — {e.subject}</div>
                <div className="meta"><span className="pill">{fmtDay(e.date)} · {fmtRelDay(e.date)}</span>{e.topic && <span className="small muted">{e.topic}</span>}</div>
              </div>
              {e.result != null ? (
                <span className={`pill ${e.result >= 14 ? "gold" : e.result >= 10 ? "green" : "red"}`} style={{ fontSize: 14 }}>{e.result}/20</span>
              ) : (
                <button className="btn sm primary" onClick={() => setResultFor(e)}>Entrer ma note</button>
              )}
              <button className={`btn sm ${e.debrief ? "ghost" : "gold"}`} onClick={() => setDebriefFor(e)}>{e.debrief ? "📝 Debrief ✓" : "📝 Debrief"}</button>
              <button className="btn sm ghost" onClick={() => setEdit(e)}>⋯</button>
            </div>
          ))}
        </div>
      )}

      {edit && <EvalForm initial={edit} onClose={() => setEdit(null)} />}
      {editTask && <TaskForm initial={editTask} onClose={() => setEditTask(null)} />}
      {resultFor && <ResultModal ev={resultFor} onClose={() => {
        // Note validée (pas annulée) : on enchaîne sur le debrief, à chaud
        const e = useStore.getState().evals.find((x) => x.id === resultFor.id);
        setResultFor(null);
        if (e && e.result != null && !e.debrief) setDebriefFor(e);
      }} />}
      {debriefFor && <DebriefModal ev={debriefFor} onClose={() => setDebriefFor(null)} />}
    </>
  );
}

function ResultModal({ ev, onClose }: { ev: Evaluation; onClose: () => void }) {
  const setResult = useStore((s) => s.setEvalResult);
  const [note, setNote] = useState<number>(12);
  const b = resultBonus(note, ev.type);
  return (
    <Modal
      title={`Note : ${ev.type} de ${ev.subject}`}
      onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={() => { setResult(ev.id, note); onClose(); }}>Valider</button></>}
    >
      <div className="row">
        <input className="input" type="number" step={0.5} min={0} max={20} value={note} onChange={(e) => setNote(Math.max(0, Math.min(20, Number(e.target.value))))} style={{ width: 100, fontSize: 22, fontWeight: 800 }} />
        <b style={{ fontSize: 22 }}>/ 20</b>
      </div>
      <input type="range" min={0} max={20} step={0.5} value={note} onChange={(e) => setNote(Number(e.target.value))} style={{ width: "100%", marginTop: 12 }} />
      <p className="small muted">La note est aussi ajoutée à tes moyennes (coef 2 pour un DS). Prime : {b.coins > 0 ? <b style={{ color: "var(--gold)" }}>+{b.coins} k€ · +{b.xp} XP</b> : "aucune sous 8/20"}.</p>
    </Modal>
  );
}
