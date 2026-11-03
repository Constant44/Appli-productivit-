/**
 * To-do : tes vraies tâches (devoirs, Pronote, ce que tu ajoutes), rangées par matière.
 * Les blocs du programme quotidien n'y sont pas : ils sont dans « Maintenant » et « Planning ».
 */
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { daysUntil, fmtDay, subjectColor } from "../lib/utils";
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
    addTask({ title: title.trim(), subject, kind: "devoir", estimateMin: 45, priority: 2 });
    setTitle("");
  };

  return (
    <div className="todo-page">
      <header className="todo-head">
        <h1 className="page-title" style={{ margin: 0 }}>To-do</h1>
        <span className="small muted">{todo.length} à faire{late ? <> · <b className="late-txt">{late} en retard</b></> : ""}</span>
      </header>

      <form className="todo-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input id="todo-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" />
        <select id="todo-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Matière">
          {subjectsList.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn primary" disabled={!title.trim()}>Ajouter</button>
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
