import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { recommend } from "../lib/insights";
import { buildMatchSheet, type Block } from "../lib/matchday";
import { fmtMin, isoDay, subjectColor } from "../lib/utils";
import { navigate } from "../App";

const hm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Feuille de match du jour + coup d'envoi : le prochain créneau se lance en un geste. */
export function MatchSheet() {
  const tasks = useStore((s) => s.tasks);
  const evals = useStore((s) => s.evals);
  const grades = useStore((s) => s.grades);
  const lessons = useStore((s) => s.lessons);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const warmups = useStore((s) => s.warmups);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const recos = useMemo(() => recommend(tasks, evals, grades, now).map((r) => r.task), [tasks, evals, grades, now]);
  const sheet = useMemo(
    () =>
      buildMatchSheet({
        now, lessons, evals, tasks: recos, sessions, work: settings.pomodoroWork, pause: settings.pomodoroBreak,
        dayStart: settings.dayStarts?.[now.getDay()], dayEnd: settings.dayEnd, goalMin: settings.dailyGoalMin, warmupDone: warmups.includes(isoDay(now)),
      }),
    [now, lessons, evals, recos, sessions, settings, warmups],
  );
  const cur = sheet.current;
  const idle = timer.status === "idle";

  const kickoff = (b: Block, mode: "pomodoro" | "free" = "pomodoro") => {
    if (b.kind === "warmup") return navigate("warmup");
    startTimer({ mode, targetMin: mode === "free" ? settings.pomodoroWork : Math.round((+b.end - +b.start) / 60000), taskId: b.taskId, subject: b.subject });
    navigate("focus");
  };

  const late = idle && cur && sheet.lateMin >= 5;
  // Vue réduite : seulement ce qui reste à venir
  const shown = open ? sheet.timeline : sheet.timeline.filter((b) => b.end > now && b !== cur).slice(0, 4);

  return (
    <div className={`card kickoff-card ${late ? "late" : ""}`}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="eyebrow">Feuille de match du jour</span>
        <span className="small muted">
          {fmtMin(sheet.playedMin)} / {fmtMin(sheet.plannedMin)}{sheet.missed ? ` · ${sheet.missed} manqué${sheet.missed > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <div className="day-progress"><div style={{ width: `${sheet.plannedMin ? Math.min(100, (sheet.playedMin / sheet.plannedMin) * 100) : 0}%` }} /></div>

      {cur ? (
        <div className="kickoff">
          <span className="kickoff-ico">{late ? "⏰" : "⚽"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small muted">
              {late ? `Coup d'envoi prévu à ${hm(cur.start)} : ${sheet.lateMin} min de retard` : cur.status === "now" ? "C'est maintenant" : `Prochain créneau à ${hm(cur.start)}`}
            </div>
            <div className="kickoff-title">{cur.label}</div>
            {cur.subject && <div className="small muted">{cur.subject} · {hm(cur.start)}–{hm(cur.end)}</div>}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <button className="btn primary big" disabled={!idle} onClick={() => kickoff(cur)}>▶ Coup d'envoi</button>
            {late && cur.kind === "work" && (
              <button className="btn sm ghost" disabled={!idle} onClick={() => kickoff(cur, "free")} title="Chronomètre libre : tu as le droit d'arrêter au bout de 5 min">
                Juste 5 min
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="kickoff">
          <span className="kickoff-ico">🌙</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kickoff-title">Fin du temps réglementaire</div>
            <div className="small muted">
              {sheet.playedMin ? `${fmtMin(sheet.playedMin)} de travail aujourd'hui. ` : ""}
              {recos[0] ? `Encore un peu à la maison ? Prochaine tâche : ${recos[0].title}` : "Repos !"}
            </div>
          </div>
          {recos[0] && (
            <button className="btn big" disabled={!idle} onClick={() => { startTimer({ mode: "pomodoro", targetMin: settings.pomodoroWork, taskId: recos[0].id, subject: recos[0].subject }); navigate("focus"); }}>
              ⏱️ Prolongations
            </button>
          )}
        </div>
      )}
      {late && <div className="small" style={{ marginBottom: 10 }}>Pas besoin de motivation pour commencer : lance « Juste 5 min ». Tu as le droit d'arrêter après, mais en général on continue.</div>}

      <div className="list">
        {shown.map((b) => (
          <div key={b.id} className="row small" style={{ gap: 8, opacity: b.kind === "busy" || b.kind === "lunch" ? 0.6 : 1 }}>
            <span className="muted" style={{ width: 92, flexShrink: 0 }}>{hm(b.start)}–{hm(b.end)}</span>
            <span className="subject-bar" style={{ background: b.subject ? subjectColor(b.subject) : "var(--bg2)", height: 14 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: b === cur ? 700 : 400 }}>
              {b.kind === "busy" ? `🏫 ${b.label}` : b.kind === "lunch" ? "🍽️ Déjeuner" : b.label}
            </span>
            {b.status === "done" && <span className="pill green">✓</span>}
            {b.status === "missed" && <span className="pill red">manqué</span>}
          </div>
        ))}
      </div>
      <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setOpen(!open)}>{open ? "Réduire" : "Toute la journée"}</button>
    </div>
  );
}
