import { useStore } from "../lib/store";
import { actualMinutes, spentMinutes } from "../lib/insights";
import { TASK_KIND_LABEL, type Task } from "../lib/types";
import { daysUntil, fmtDay, fmtMin, fmtRelDay, subjectColor } from "../lib/utils";
import { navigate } from "../App";

export function TaskRow({ task, onEdit, onComplete, compact }: { task: Task; onEdit: () => void; onComplete: () => void; compact?: boolean }) {
  const sessions = useStore((s) => s.sessions);
  const evals = useStore((s) => s.evals);
  const startTimer = useStore((s) => s.startTimer);
  const pomodoro = useStore((s) => s.settings.pomodoroWork);
  const reopen = useStore((s) => s.reopenTask);
  const timerBusy = useStore((s) => s.timer.status !== "idle");
  const spent = spentMinutes(task, sessions);
  const actual = actualMinutes(task, sessions);
  const ev = task.evalId ? evals.find((e) => e.id === task.evalId) : undefined;
  const dd = task.due ? daysUntil(task.due) : null;

  return (
    <div className={`item ${task.done ? "done" : ""}`}>
      <span className="subject-bar" style={{ background: subjectColor(task.subject) }} />
      <button className={`check ${task.done ? "on" : ""}`} onClick={() => (task.done ? reopen(task.id) : onComplete())} title={task.done ? "Rouvrir" : "Terminer"}>
        {task.done ? "✓" : ""}
      </button>
      <div className="body" onClick={onEdit} style={{ cursor: "pointer" }}>
        <div className="title">
          {task.priority === 3 && !task.done && "🔥 "}
          {task.title}
        </div>
        {task.notes && (
          <div className="small muted" style={{ overflowWrap: "anywhere" }}>
            {task.notes.split(/(https?:\/\/\S+)/).map((part, i) =>
              /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>lien ↗</a> : part,
            )}
          </div>
        )}
        <div className="meta">
          <span className="pill">{task.subject}</span>
          {!compact && <span className="pill">{TASK_KIND_LABEL[task.kind]}</span>}
          {task.source === "pronote" && <span className="pill blue">Pronote</span>}
          {dd !== null && !task.done && (
            <span className={`pill ${dd < 0 ? "red" : dd <= 1 ? "gold" : ""}`}>📅 {fmtDay(task.due!)} · {fmtRelDay(task.due!)}</span>
          )}
          {ev && <span className="pill purple">🎯 {ev.type} {ev.subject} {fmtRelDay(ev.date)}</span>}
          <span className="pill">
            ⏳ {task.done && actual ? `${fmtMin(actual)} / ${fmtMin(task.estimateMin)} estimé` : `${spent ? fmtMin(spent) + " / " : ""}${fmtMin(task.estimateMin)}`}
          </span>
        </div>
      </div>
      {!task.done && (
        <button
          className="btn sm primary" disabled={timerBusy} title={timerBusy ? "Un timer tourne déjà" : "Lancer un pomodoro"}
          onClick={() => {
            startTimer({ mode: "pomodoro", targetMin: pomodoro, taskId: task.id, subject: task.subject });
            navigate("focus");
          }}
        >
          ▶
        </button>
      )}
    </div>
  );
}
