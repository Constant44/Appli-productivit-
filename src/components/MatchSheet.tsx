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
  const shown = open ? sheet.timeline : sheet.timeline.filter((b) => b.kind !== "busy" || b.end > now).slice(0, 6);

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: late ? "var(--red)" : undefined }}>
      <h3>
        📋 Feuille de match du jour
        <span className="right small muted">
          {fmtMin(sheet.playedMin)} jouées / {fmtMin(sheet.plannedMin)} prévues{sheet.missed ? ` · ${sheet.missed} créneau${sheet.missed > 1 ? "x" : ""} manqué${sheet.missed > 1 ? "s" : ""}` : ""}
        </span>
      </h3>

      {cur ? (
        <div className="reco" style={{ borderColor: late ? "var(--red)" : "var(--accent)", marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{late ? "⏰" : "⚽"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small muted">
              {late ? `Coup d'envoi prévu à ${hm(cur.start)} : ${sheet.lateMin} min de retard` : cur.status === "now" ? "C'est maintenant" : `Prochain créneau à ${hm(cur.start)}`}
            </div>
            <b>{cur.label}</b>
            {cur.subject && <div className="small muted">{cur.subject} · {hm(cur.start)}–{hm(cur.end)}</div>}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <button className="btn primary" disabled={!idle} onClick={() => kickoff(cur)}>▶ Coup d'envoi</button>
            {late && cur.kind === "work" && (
              <button className="btn sm ghost" disabled={!idle} onClick={() => kickoff(cur, "free")} title="Chronomètre libre : tu as le droit d'arrêter au bout de 5 min">
                Juste 5 min
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="small muted" style={{ marginBottom: 10 }}>Journée terminée{sheet.playedMin ? ` : ${fmtMin(sheet.playedMin)} de travail, bien joué` : ""}. Repos ! 🌙</div>
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
