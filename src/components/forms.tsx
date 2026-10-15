import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { calibrationData, correctedEstimate, spentMinutes } from "../lib/insights";
import { EVAL_TYPES, TASK_KIND_LABEL, type Evaluation, type Task, type TaskKind } from "../lib/types";
import { fmtDay, fmtMin, fmtTime, isoDay } from "../lib/utils";
import { DurationInput, Field, Modal, Seg, SubjectSelect } from "./ui";

type TaskDraft = Partial<Task>;

export function TaskForm({ initial, onClose }: { initial?: TaskDraft; onClose: () => void }) {
  const { addTask, updateTask, deleteTask, tasks, sessions, plans, evals, settings } = useStore();
  const [d, setD] = useState<TaskDraft>({
    title: "", subject: settings.subjects[0] ?? "Maths", kind: "devoir", estimateMin: 45, priority: 2, ...initial,
  });
  const cal = useMemo(() => calibrationData(tasks, sessions), [tasks, sessions]);
  const corr = correctedEstimate(d.estimateMin ?? 0, d.subject ?? "", cal);
  const editing = !!initial?.id;
  const upcomingEvals = evals.filter((e) => new Date(e.date) > new Date(Date.now() - 864e5)).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const set = (p: TaskDraft) => setD((x) => ({ ...x, ...p }));

  const save = () => {
    if (!d.title?.trim()) return;
    const payload = {
      title: d.title.trim(), subject: d.subject || "Perso", kind: (d.kind ?? "devoir") as TaskKind, due: d.due || undefined,
      estimateMin: d.estimateMin ?? 30, priority: (d.priority ?? 2) as 1 | 2 | 3, planId: d.planId || undefined,
      evalId: d.evalId || undefined, notes: d.notes, actualMinManual: d.actualMinManual,
    };
    if (editing) updateTask(initial!.id!, payload);
    else addTask(payload);
    onClose();
  };

  return (
    <Modal
      title={editing ? "Modifier la tâche" : "Nouvelle tâche"}
      onClose={onClose}
      actions={
        <>
          {editing && (
            <button className="btn danger" onClick={() => { deleteTask(initial!.id!); onClose(); }}>Supprimer</button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={save} disabled={!d.title?.trim()}>Enregistrer</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Intitulé">
          <input className="input" autoFocus value={d.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="ex : Exos 1 à 8 feuille probas" />
        </Field>
        <div className="form-grid">
          <Field label="Matière"><SubjectSelect value={d.subject ?? ""} onChange={(v) => set({ subject: v })} /></Field>
          <Field label="Type">
            <select className="input" value={d.kind} onChange={(e) => set({ kind: e.target.value as TaskKind })}>
              {Object.entries(TASK_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Pour le">
            <input className="input" type="date" value={d.due ?? ""} onChange={(e) => set({ due: e.target.value })} />
          </Field>
        </div>
        <Field label="Priorité">
          <Seg value={d.priority ?? 2} onChange={(v) => set({ priority: v as 1 | 2 | 3 })} options={[[1, "Basse"], [2, "Normale"], [3, "🔥 Haute"]]} />
        </Field>
        <Field label="Temps estimé (min)">
          <DurationInput value={d.estimateMin} onChange={(v) => set({ estimateMin: v })} />
        </Field>
        {corr.basis && Math.abs(corr.factor - 1) > 0.08 && (
          <div className="pill gold" style={{ whiteSpace: "normal" }}>
            🎯 D'après ton historique{corr.basis !== "global" ? ` en ${corr.basis}` : ""}, tu mets ×{corr.factor.toFixed(2)} le temps prévu :
            compte plutôt ~{fmtMin(corr.value)}.
          </div>
        )}
        {editing && (
          <Field label={`Temps réel (min) — sessions chronométrées : ${fmtMin(spentMinutes(initial as Task, sessions))}`}>
            <input
              className="input" type="number" min={0} placeholder="laisser vide = temps des sessions"
              value={d.actualMinManual ?? ""} onChange={(e) => set({ actualMinManual: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
        )}
        <div className="form-grid">
          <Field label="Plan de révision">
            <select className="input" value={d.planId ?? ""} onChange={(e) => set({ planId: e.target.value })}>
              <option value="">— Aucun —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Prépare une éval">
            <select className="input" value={d.evalId ?? ""} onChange={(e) => {
              const ev = evals.find((x) => x.id === e.target.value);
              set({ evalId: e.target.value, subject: ev?.subject ?? d.subject });
            }}>
              <option value="">— Aucune —</option>
              {upcomingEvals.map((e) => <option key={e.id} value={e.id}>{e.type} {e.subject} · {fmtDay(e.date)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={2} value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** Modale « J'ai fini » : demande le temps réel. */
export function CompleteTaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { sessions, completeTask } = useStore();
  const spent = spentMinutes(task, sessions);
  const [actual, setActual] = useState<number | undefined>(task.actualMinManual ?? (spent || undefined));
  const err = actual && task.estimateMin ? actual / task.estimateMin - 1 : null;
  return (
    <Modal
      title="✅ Tâche terminée"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={() => { completeTask(task.id, actual); onClose(); }}>Valider</button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}><b>{task.title}</b></p>
      <p className="muted">Tu avais estimé <b>{fmtMin(task.estimateMin)}</b>.{spent > 0 && <> Tes sessions chronométrées font <b>{fmtMin(spent)}</b>.</>} Combien de temps ça t'a <i>réellement</i> pris ?</p>
      <DurationInput value={actual} onChange={setActual} />
      {err !== null && (
        <p className="small" style={{ marginBottom: 0 }}>
          Écart : <b style={{ color: Math.abs(err) <= 0.15 ? "var(--accent)" : Math.abs(err) <= 0.3 ? "var(--gold)" : "var(--red)" }}>
            {err >= 0 ? "+" : ""}{Math.round(err * 100)} %
          </b>{" "}
          {Math.abs(err) <= 0.15 ? "→ bonus estimation chirurgicale 🎯" : Math.abs(err) <= 0.3 ? "→ bonus bonne estimation" : "→ pas de bonus précision, mais l'appli apprend ton rythme"}
        </p>
      )}
    </Modal>
  );
}

export function EvalForm({ initial, onClose }: { initial?: Partial<Evaluation>; onClose: () => void }) {
  const { addEval, updateEval, deleteEval, settings } = useStore();
  const editing = !!initial?.id;
  const d0 = initial?.date ? new Date(initial.date) : new Date(Date.now() + 2 * 864e5);
  const [e, setE] = useState<Partial<Evaluation>>({ type: "Khôlle", subject: settings.subjects[0], durationMin: 60, ...initial });
  const [day, setDay] = useState(isoDay(d0));
  const [time, setTime] = useState(initial?.date ? fmtTime(d0).replace("h", ":") : "17:00");
  const set = (p: Partial<Evaluation>) => setE((x) => ({ ...x, ...p }));
  const save = () => {
    const date = new Date(`${day}T${time}`).toISOString();
    const payload = {
      type: e.type!, subject: e.subject || "Maths", date, durationMin: e.durationMin, topic: e.topic, examiner: e.examiner, room: e.room,
    };
    if (editing) updateEval(initial!.id!, payload);
    else addEval(payload);
    onClose();
  };
  return (
    <Modal
      title={editing ? "Modifier" : "Nouveau DS / khôlle"}
      onClose={onClose}
      actions={
        <>
          {editing && <button className="btn danger" onClick={() => { deleteEval(initial!.id!); onClose(); }}>Supprimer</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={save}>Enregistrer</button>
        </>
      }
    >
      <div className="stack">
        <Seg value={e.type!} onChange={(v) => set({ type: v, durationMin: v === "DS" || v === "Concours blanc" ? 240 : v === "Khôlle" ? 60 : e.durationMin })} options={EVAL_TYPES.map((t) => [t, t])} />
        <div className="form-grid">
          <Field label="Matière"><SubjectSelect value={e.subject ?? ""} onChange={(v) => set({ subject: v })} /></Field>
          <Field label="Jour"><input className="input" type="date" value={day} onChange={(x) => setDay(x.target.value)} /></Field>
          <Field label="Heure"><input className="input" type="time" value={time} onChange={(x) => setTime(x.target.value)} /></Field>
          <Field label="Durée (min)"><input className="input" type="number" value={e.durationMin ?? ""} onChange={(x) => set({ durationMin: Number(x.target.value) || undefined })} /></Field>
        </div>
        <Field label="Programme / chapitres"><input className="input" value={e.topic ?? ""} onChange={(x) => set({ topic: x.target.value })} placeholder="ex : Probabilités discrètes, chap. 7-8" /></Field>
        <div className="form-grid">
          <Field label="Colleur / prof"><input className="input" value={e.examiner ?? ""} onChange={(x) => set({ examiner: x.target.value })} /></Field>
          <Field label="Salle"><input className="input" value={e.room ?? ""} onChange={(x) => set({ room: x.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}
