import { useState } from "react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { daysUntil, fmtMin } from "../lib/utils";
import { Seg } from "../components/ui";
import { CompleteTaskModal, TaskForm } from "../components/forms";
import { TaskRow } from "../components/TaskRow";

type Filter = "todo" | "done" | "all";

export default function Tasks() {
  const { tasks, settings, addTask } = useStore();
  const [filter, setFilter] = useState<Filter>("todo");
  const [subject, setSubject] = useState("");
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [quick, setQuick] = useState("");

  const subjects = [...new Set(tasks.map((t) => t.subject))].sort();
  const list = tasks
    .filter((t) => (filter === "todo" ? !t.done : filter === "done" ? t.done : true))
    .filter((t) => !subject || t.subject === subject);

  const groups: Array<[string, Task[]]> = filter === "done"
    ? [["Terminées", list.sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))]]
    : [
        ["🔴 En retard", list.filter((t) => !t.done && t.due && daysUntil(t.due) < 0)],
        ["📍 Aujourd'hui & demain", list.filter((t) => !t.done && t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 1)],
        ["🗓️ Cette semaine", list.filter((t) => !t.done && t.due && daysUntil(t.due) > 1 && daysUntil(t.due) <= 7)],
        ["⏭️ Plus tard", list.filter((t) => !t.done && t.due && daysUntil(t.due) > 7)],
        ["📥 Sans date", list.filter((t) => !t.done && !t.due)],
        ["✅ Terminées", filter === "all" ? list.filter((t) => t.done) : []],
      ];
  for (const [, g] of groups) g.sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9") || b.priority - a.priority);

  const todoMin = tasks.filter((t) => !t.done).reduce((a, b) => a + b.estimateMin, 0);

  const quickAdd = () => {
    // Syntaxe rapide : "Exos probas #Maths 45m !"  (# matière, durée en m ou h, ! = priorité haute)
    if (!quick.trim()) return;
    let title = quick;
    let subj = subject || settings.subjects[0] || "Perso";
    let est = 45;
    let priority: 1 | 2 | 3 = 2;
    const sm = title.match(/#(\S+)/);
    if (sm) {
      const found = settings.subjects.find((s) => s.toLowerCase().startsWith(sm[1].toLowerCase()));
      subj = found ?? sm[1];
      title = title.replace(sm[0], "");
    }
    const dm = title.match(/(\d+(?:[.,]\d+)?)\s*(h|m|min)\b/i);
    if (dm) {
      const v = parseFloat(dm[1].replace(",", "."));
      est = Math.round(dm[2].toLowerCase() === "h" ? v * 60 : v);
      title = title.replace(dm[0], "");
    }
    if (/!\s*$/.test(title)) {
      priority = 3;
      title = title.replace(/!\s*$/, "");
    }
    addTask({ title: title.trim(), subject: subj, kind: "devoir", estimateMin: est, priority });
    setQuick("");
  };

  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title">To-do & devoirs</h1>
          <p className="page-sub">{tasks.filter((t) => !t.done).length} tâches à faire · ~{fmtMin(todoMin)} estimées au total</p>
        </div>
        <button className="btn primary" onClick={() => setEdit({ subject: subject || undefined })}>+ Nouvelle tâche</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input
            className="input" style={{ flex: 1, minWidth: 220 }} value={quick} onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            placeholder="Ajout rapide : « Exos 1-8 feuille 12 #Maths 1h30 ! »  (# matière · durée · ! = urgent)"
          />
          <button className="btn" onClick={quickAdd}>Ajouter</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Seg value={filter} onChange={setFilter} options={[["todo", "À faire"], ["done", "Terminées"], ["all", "Tout"]]} />
          <select className="input" style={{ width: "auto" }} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Toutes les matières</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {groups.filter(([, g]) => g.length).map(([label, g]) => (
          <div key={label}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <b>{label}</b>
              <span className="muted small">{g.length} · {fmtMin(g.reduce((a, b) => a + b.estimateMin, 0))}</span>
            </div>
            <div className="list">
              {g.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEdit(t)} onComplete={() => setCompleting(t)} />)}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="empty card">Rien ici. Profites-en… ou ajoute une tâche ! 😄</div>}
      </div>

      {edit && <TaskForm initial={edit} onClose={() => setEdit(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </>
  );
}
