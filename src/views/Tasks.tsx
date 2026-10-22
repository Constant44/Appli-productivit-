import { useState } from "react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { daysUntil, fmtMin, fmtRelDay, subjectColor } from "../lib/utils";
import { CompleteTaskModal, TaskForm } from "../components/forms";
import { navigate } from "../App";

/** Fantômes de tactiques à moitié effacées sur le tableau (4-3-3, flèches, croix et ronds). */
function TacticsGhost() {
  return (
    <svg className="wb-ghost" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round">
        <rect x="430" y="40" width="330" height="420" rx="6" />
        <line x1="430" y1="250" x2="760" y2="250" />
        <circle cx="595" cy="250" r="44" />
        <rect x="520" y="40" width="150" height="62" />
        <rect x="520" y="398" width="150" height="62" />
        {[[480, 140], [595, 120], [710, 140]].map(([x, y], i) => <g key={i}><line x1={x - 10} y1={y - 10} x2={x + 10} y2={y + 10} /><line x1={x + 10} y1={y - 10} x2={x - 10} y2={y + 10} /></g>)}
        {[[500, 300], [595, 330], [690, 300], [470, 380], [560, 400], [630, 400], [720, 380]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" />)}
        <path d="M500 290 Q520 220 470 160" /><path d="M462 168 L470 160 L478 170" />
        <path d="M595 318 Q640 230 610 140" strokeDasharray="10 9" />
        <path d="M60 420 Q160 360 260 410" strokeDasharray="8 10" />
      </g>
    </svg>
  );
}

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

  const startTimer = useStore((s) => s.startTimer);
  const timer = useStore((s) => s.timer);
  const markerOf = (label: string) => (label.includes("retard") ? "red" : label.includes("Aujourd") ? "blue" : label.includes("Terminées") ? "green" : "black");

  return (
    <>
      <div className="wb">
        <TacticsGhost />
        <div className="wb-head">
          <h1 className="wb-title">To-do</h1>
          <span className="wb-note">{tasks.filter((t) => !t.done).length} à faire · ~{fmtMin(todoMin)}</span>
        </div>

        <div className="wb-add">
          <span className="wb-pen">✎</span>
          <input
            value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            placeholder="Écris une tâche… « Exos feuille 12 #Maths 1h30 ! »" aria-label="Nouvelle tâche"
          />
          <button className="magnet green" onClick={quickAdd} aria-label="Ajouter">+</button>
          <button className="wb-link" onClick={() => setEdit({ subject: subject || undefined })}>détails…</button>
        </div>

        <div className="wb-filters">
          {([["todo", "À faire"], ["done", "Terminées"], ["all", "Tout"]] as const).map(([k, l]) => (
            <button key={k} className={`magnet-pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}><i />{l}</button>
          ))}
          <select className="wb-select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Matière">
            <option value="">toutes les matières</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="wb-groups">
          {groups.filter(([, g]) => g.length).map(([label, g]) => (
            <section key={label} className={`wb-group m-${markerOf(label)}`}>
              <h2>{label.replace(/^\S+\s/, "")} <small>{g.length} · {fmtMin(g.reduce((x, y) => x + y.estimateMin, 0))}</small></h2>
              {g.map((t) => (
                <div key={t.id} className={`wb-task ${t.done ? "done" : ""} ${t.priority === 3 ? "urgent" : ""}`}>
                  <button className="wb-check" aria-label={t.done ? "Rouvrir" : "Terminer"} onClick={() => (t.done ? useStore.getState().reopenTask(t.id) : setCompleting(t))}>
                    <svg viewBox="0 0 32 32"><path d="M4 5 Q16 3 28 5 Q30 16 27 28 Q16 30 5 27 Q3 16 4 5Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />{t.done && <path className="tick" d="M8 17 L14 23 L26 7" fill="none" stroke="#16a34a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}</svg>
                  </button>
                  <div className="wb-text" onClick={() => setEdit(t)}>
                    <span className="wb-line">{t.priority === 3 && !t.done ? "! " : ""}{t.title}{t.done && <svg className="strike" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 6 Q25 3 50 6 T100 5" stroke="#1f2937" strokeWidth="2.2" fill="none" /></svg>}</span>
                    <span className="wb-meta"><i className="dot" style={{ background: subjectColor(t.subject) }} /> {t.subject} · {fmtMin(t.estimateMin)}{t.due ? ` · ${fmtRelDay(t.due)}` : ""}</span>
                  </div>
                  {!t.done && (
                    <button className="magnet play" aria-label="Lancer une session" disabled={timer.status !== "idle"}
                      onClick={() => { startTimer({ mode: "pomodoro", targetMin: settings.pomodoroWork, taskId: t.id, subject: t.subject }); navigate("focus"); }}>▶</button>
                  )}
                </div>
              ))}
            </section>
          ))}
          {list.length === 0 && <p className="wb-empty">Tableau vide. Écris ta prochaine tâche en haut ✎</p>}
        </div>

        <div className="wb-tray" aria-hidden>
          <span className="marker black" /><span className="marker blue" /><span className="marker red" /><span className="eraser" />
        </div>
      </div>

      {edit && <TaskForm initial={edit} onClose={() => setEdit(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </>
  );
}
