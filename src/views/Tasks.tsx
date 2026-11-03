/**
 * To-do : tes vraies tâches (devoirs, Pronote, ce que tu ajoutes), rangées par matière.
 * Les blocs du programme quotidien n'y sont pas : ils sont dans « Maintenant » et « Planning ».
 */
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { TASK_KIND_LABEL, type Task, type TaskKind } from "../lib/types";
import { daysUntil, fmtDay, isoDay, subjectColor } from "../lib/utils";
import { CompleteTaskModal, TaskForm } from "../components/forms";

const SHOWN = 5;

/** Échéance en clair : « en retard (3 j) », « aujourd'hui », « demain », « ven. 06/11 ». */
function dueLabel(t: Task): { text: string; tone: "late" | "soon" | "" } | null {
  if (!t.due) return null;
  const d = daysUntil(t.due);
  if (d < 0) return { text: `en retard (${-d} j)`, tone: "late" };
  if (d === 0) return { text: "aujourd'hui", tone: "soon" };
  if (d === 1) return { text: "demain", tone: "soon" };
  return { text: fmtDay(`${t.due}T12:00:00`), tone: "" };
}

export default function Tasks() {
  const tasks = useStore((s) => s.tasks);
  const subjectsList = useStore((s) => s.settings.subjects);
  const addTask = useStore((s) => s.addTask);
  const reopenTask = useStore((s) => s.reopenTask);
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjectsList[0] ?? "Maths");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [kind, setKind] = useState<TaskKind>("devoir");
  const [evalId, setEvalId] = useState("");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const evals = useStore((s) => s.evals);
  const upcomingEvals = useMemo(() => evals.filter((e) => +new Date(e.date) > Date.now() - 864e5).sort((a, b) => a.date.localeCompare(b.date)), [evals]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(() => tasks.filter((t) => !t.program), [tasks]);
  const todo = mine.filter((t) => !t.done);
  const late = todo.filter((t) => t.due && daysUntil(t.due) < 0).length;

  // Une carte par matière ; la matière la plus urgente d'abord
  const groups = useMemo(() => {
    const by = new Map<string, Task[]>();
    for (const t of todo) by.set(t.subject, [...(by.get(t.subject) ?? []), t]);
    const sortKey = (t: Task) => `${t.due ?? "9999"}-${3 - t.priority}`;
    return [...by.entries()]
      .map(([s, l]) => [s, l.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))] as const)
      .sort((a, b) => sortKey(a[1][0]).localeCompare(sortKey(b[1][0])) || a[0].localeCompare(b[0]));
  }, [todo]);

  const done = mine.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")).slice(0, 20);

  const add = () => {
    if (!title.trim()) return;
    const ev = evals.find((e) => e.id === evalId);
    addTask({
      title: title.trim(), subject, kind, estimateMin: 45, priority,
      due: due || (ev ? isoDay(ev.date) : undefined), evalId: evalId || undefined, notes: notes.trim() || undefined,
    });
    setTitle(""); setDue(""); setPriority(2); setKind("devoir"); setEvalId(""); setNotes(""); setExpanded(false);
  };

  return (
    <div className="todo-page">
      <header className="todo-head">
        <h1 className="page-title" style={{ margin: 0 }}>To-do</h1>
        <span className="small muted">{todo.length} à faire{late ? <> · <b className="late-txt">{late} en retard</b></> : ""}</span>
      </header>

      <form className={`todo-add card ${expanded || title ? "open" : ""}`} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="todo-add-row">
          <input id="todo-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setExpanded(true)} placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" />
          <select id="todo-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Matière">
            {subjectsList.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        {(expanded || title) && (
          <div className="todo-add-more">
            <label className="todo-field"><span>Type</span>
              <select id="todo-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
                {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => <option key={k} value={k}>{TASK_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="todo-field"><span>Pour le</span>
              <input id="todo-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="todo-field"><span>Prépare un DS / une khôlle</span>
              <select id="todo-eval" className="input" value={evalId} onChange={(e) => { setEvalId(e.target.value); const ev = evals.find((x) => x.id === e.target.value); if (ev) { setSubject(ev.subject); if (kind === "devoir") setKind("revision"); } }}>
                <option value="">Non</option>
                {upcomingEvals.map((e) => <option key={e.id} value={e.id}>{e.type} {e.subject} · {fmtDay(e.date)}</option>)}
              </select>
            </label>
            <div className="todo-field"><span>Priorité</span>
              <div className="prio-seg" role="group" aria-label="Priorité">
                {([[1, "Basse"], [2, "Normale"], [3, "Haute"]] as const).map(([v, l]) => (
                  <button type="button" key={v} className={priority === v ? `on p${v}` : ""} onClick={() => setPriority(v)}>{l}</button>
                ))}
              </div>
            </div>
            <label className="todo-field wide"><span>Notes</span>
              <textarea id="todo-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Page, exercices, consignes…" />
            </label>
            <div className="todo-add-actions">
              <button type="button" className="btn ghost" onClick={() => { setTitle(""); setExpanded(false); }}>Annuler</button>
              <button className="btn primary" disabled={!title.trim()}>Ajouter</button>
            </div>
          </div>
        )}
      </form>

      {groups.length === 0 && <div className="card empty">Rien à faire en dehors du programme du jour 🙌</div>}

      <div className="subject-grid">
        {groups.map(([s, list]) => {
          const shown = open[s] ? list : list.slice(0, SHOWN);
          return (
            <section key={s} className="subject-card" style={{ ["--subj" as string]: subjectColor(s) }}>
              <h2><span className="dot" />{s}<small>{list.length}</small></h2>
              {shown.map((t) => {
                const due = dueLabel(t);
                return (
                  <div key={t.id} className="subject-task">
                    <button className="tick-btn" aria-label="Terminer" onClick={() => setCompleting(t)} />
                    <button className="subject-task-t" onClick={() => setEdit(t)}>
                      {t.priority === 3 && <b className="late-txt">! </b>}{t.title}
                      <span className="subject-task-m">
                        {due && <span className={`due ${due.tone}`}>{due.text}</span>}
                        {t.kind !== "devoir" && <span>{TASK_KIND_LABEL[t.kind]}</span>}
                        {t.notes && <span title={t.notes}>📝 {t.notes.length > 40 ? `${t.notes.slice(0, 40)}…` : t.notes}</span>}
                        {t.source === "pronote" && <span className="pn">Pronote</span>}
                      </span>
                    </button>
                  </div>
                );
              })}
              {list.length > SHOWN && (
                <button className="btn ghost sm" onClick={() => setOpen({ ...open, [s]: !open[s] })}>
                  {open[s] ? "Réduire" : `+ ${list.length - SHOWN} autre${list.length - SHOWN > 1 ? "s" : ""}`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="btn ghost sm" onClick={() => setShowDone(!showDone)}>{showDone ? "Masquer" : "Voir"} les tâches terminées ({done.length})</button>
          {showDone && (
            <div className="card" style={{ marginTop: 8 }}>
              {done.map((t) => (
                <div key={t.id} className="subject-task done">
                  <button className="tick-btn on" aria-label="Rouvrir" onClick={() => reopenTask(t.id)}>✓</button>
                  <span className="subject-task-t">{t.title}<span className="subject-task-m"><span>{t.subject}</span></span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {edit && <TaskForm initial={edit} onClose={() => setEdit(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}
