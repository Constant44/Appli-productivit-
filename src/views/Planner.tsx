import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { buildSchedule, calibrationData, correctedEstimate, spentMinutes } from "../lib/insights";
import type { Plan, Task } from "../lib/types";
import { addDays, fmtDay, fmtMin, isoDay, subjectColor } from "../lib/utils";
import { Bar, Field, Modal } from "../components/ui";
import { CompleteTaskModal, TaskForm } from "../components/forms";
import { TaskRow } from "../components/TaskRow";

const WD = ["D", "L", "M", "M", "J", "V", "S"];

export default function Planner() {
  const { plans, tasks, sessions } = useStore();
  const [selected, setSelected] = useState<string>(plans[0]?.id ?? "");
  const [editPlan, setEditPlan] = useState<Partial<Plan> | null>(null);
  const plan = plans.find((p) => p.id === selected) ?? plans[0];

  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title">Périodes de révision</h1>
          <p className="page-sub">Liste ce que tu veux faire, estime le temps, et l'appli répartit tout sur tes jours dispo — en corrigeant tes estimations d'après ton historique.</p>
        </div>
        <button className="btn primary" onClick={() => setEditPlan({})}>+ Nouvelle période</button>
      </div>
      {plans.length === 0 ? (
        <div className="card empty">
          Pas encore de période de révision.<br />
          Ex : « Vacances de la Toussaint », « Semaine avant le concours blanc »…<br />
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setEditPlan({})}>Créer ma première période</button>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            {plans.map((p) => (
              <button key={p.id} className={`btn ${plan?.id === p.id ? "primary" : ""}`} onClick={() => setSelected(p.id)}>{p.name}</button>
            ))}
          </div>
          {plan && <PlanDetail plan={plan} tasks={tasks} sessions={sessions} onEdit={() => setEditPlan(plan)} />}
        </>
      )}
      {editPlan && <PlanForm initial={editPlan} onClose={(id) => { setEditPlan(null); if (id) setSelected(id); }} />}
    </>
  );
}

function PlanDetail({ plan, tasks, sessions, onEdit }: { plan: Plan; tasks: Task[]; sessions: ReturnType<typeof useStore.getState>["sessions"]; onEdit: () => void }) {
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const cal = useMemo(() => calibrationData(tasks, sessions), [tasks, sessions]);
  const sched = useMemo(() => buildSchedule(plan, tasks, sessions, cal), [plan, tasks, sessions, cal]);
  const planTasks = tasks.filter((t) => t.planId === plan.id);
  const done = planTasks.filter((t) => t.done);
  const rawTotal = planTasks.filter((t) => !t.done).reduce((a, b) => a + b.estimateMin, 0);
  const spentTotal = planTasks.reduce((a, t) => a + spentMinutes(t, sessions), 0);
  const today = isoDay(new Date());
  const ratio = sched.capacity ? sched.needed / sched.capacity : Infinity;
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g4">
        <div className="card stat"><span className="v">{done.length}/{planTasks.length}</span><span className="l">tâches faites</span><Bar value={done.length} max={planTasks.length || 1} /></div>
        <div className="card stat"><span className="v">{fmtMin(sched.needed)}</span><span className="l">reste (corrigé) · brut {fmtMin(rawTotal)}</span></div>
        <div className="card stat"><span className="v">{fmtMin(sched.capacity)}</span><span className="l">dispo jusqu'au {fmtDay(plan.end)}</span></div>
        <div className="card stat">
          <span className="v" style={{ color: ratio > 1 ? "var(--red)" : ratio > 0.85 ? "var(--gold)" : "var(--accent)" }}>{Number.isFinite(ratio) ? Math.round(ratio * 100) : "—"} %</span>
          <span className="l">charge · {fmtMin(spentTotal)} déjà bossées</span>
        </div>
      </div>

      {ratio > 1 && (
        <div className="card" style={{ borderColor: "#f8717166" }}>
          ⚠️ <b>Plan trop chargé</b> : il manque {fmtMin(sched.needed - sched.capacity)}. Augmente ton temps quotidien, retire des jours off, ou priorise (les tâches les moins urgentes sont listées « non planifiées »).
        </div>
      )}

      <div className="card">
        <h3>🗓️ Planning jour par jour <span className="right"><button className="btn sm" onClick={onEdit}>Modifier la période</button></span></h3>
        <div className="days-plan">
          {sched.days.map((d) => (
            <div key={d.date} className={`day-card ${d.date === today ? "today" : ""} ${d.capacity === 0 ? "off" : ""}`}>
              <div className="row between small"><b>{fmtDay(d.date)}</b><span className="muted">{d.capacity ? `${fmtMin(d.load)}/${fmtMin(d.capacity)}` : "off"}</span></div>
              {d.capacity > 0 && <div style={{ margin: "6px 0" }}><Bar value={d.load} max={d.capacity} tone={d.load > d.capacity ? "red" : undefined} /></div>}
              <div className="stack" style={{ gap: 4 }}>
                {d.items.map((it) => {
                  const t = taskById.get(it.taskId)!;
                  return (
                    <div key={it.taskId} className="small row" style={{ gap: 6, flexWrap: "nowrap" }} title={t.title}>
                      <span className="dot" style={{ background: subjectColor(t.subject) }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: it.late ? "var(--red)" : undefined }}>{t.title}</span>
                      <b>{fmtMin(it.minutes)}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {sched.unscheduled.length > 0 && (
          <>
            <hr className="sep" />
            <b style={{ color: "var(--red)" }}>Non planifiées faute de temps :</b>
            <ul className="small">{sched.unscheduled.map((u) => <li key={u.task.id}>{u.task.title} — {fmtMin(u.minutes)}</li>)}</ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>📋 Ce que je veux faire <span className="right"><button className="btn sm primary" onClick={() => setEdit({ planId: plan.id, kind: "revision" })}>+ Ajouter</button></span></h3>
        <div className="list">
          {planTasks.length === 0 && <div className="empty">Ajoute les chapitres, fiches, exos, DS à refaire… avec ton estimation de temps.</div>}
          {planTasks.sort((a, b) => Number(a.done) - Number(b.done)).map((t) => {
            const c = correctedEstimate(t.estimateMin, t.subject, cal);
            return (
              <div key={t.id}>
                <TaskRow task={t} onEdit={() => setEdit(t)} onComplete={() => setCompleting(t)} />
                {!t.done && c.basis && Math.abs(c.factor - 1) > 0.08 && (
                  <div className="small muted" style={{ padding: "2px 0 0 28px" }}>↳ estimation corrigée : {fmtMin(c.value)} (×{c.factor.toFixed(2)})</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {edit && <TaskForm initial={edit} onClose={() => setEdit(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}

function PlanForm({ initial, onClose }: { initial: Partial<Plan>; onClose: (id?: string) => void }) {
  const { addPlan, updatePlan, deletePlan } = useStore();
  const [p, setP] = useState<Partial<Plan>>({
    name: "", start: isoDay(new Date()), end: isoDay(addDays(new Date(), 14)), dailyMin: 180, daysOff: [], ...initial,
  });
  const editing = !!initial.id;
  const save = () => {
    const data = { name: p.name || "Révisions", start: p.start!, end: p.end!, dailyMin: p.dailyMin ?? 120, daysOff: p.daysOff ?? [] };
    if (editing) { updatePlan(initial.id!, data); onClose(); }
    else onClose(addPlan(data));
  };
  return (
    <Modal
      title={editing ? "Modifier la période" : "Nouvelle période de révision"}
      onClose={() => onClose()}
      actions={
        <>
          {editing && <button className="btn danger" onClick={() => { if (confirm("Supprimer cette période ? (les tâches sont conservées)")) { deletePlan(initial.id!); onClose(); } }}>Supprimer</button>}
          <span className="spacer" />
          <button className="btn" onClick={() => onClose()}>Annuler</button>
          <button className="btn primary" onClick={save}>Enregistrer</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Nom"><input className="input" autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="ex : Vacances de Noël" /></Field>
        <div className="form-grid">
          <Field label="Début"><input className="input" type="date" value={p.start} onChange={(e) => setP({ ...p, start: e.target.value })} /></Field>
          <Field label="Fin"><input className="input" type="date" value={p.end} onChange={(e) => setP({ ...p, end: e.target.value })} /></Field>
          <Field label="Temps de travail / jour (min)"><input className="input" type="number" value={p.dailyMin} onChange={(e) => setP({ ...p, dailyMin: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Jours off">
          <div className="row" style={{ gap: 4 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" className={`btn sm ${p.daysOff?.includes(d) ? "primary" : ""}`}
                onClick={() => setP({ ...p, daysOff: p.daysOff?.includes(d) ? p.daysOff.filter((x) => x !== d) : [...(p.daysOff ?? []), d] })}>
                {WD[d]}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
