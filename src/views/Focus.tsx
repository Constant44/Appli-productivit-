import { useEffect, useMemo, useState } from "react";
import { timerElapsedMs, useStore, type TimerState } from "../lib/store";
import { currentStreak, minutesByDay, recommend } from "../lib/insights";
import { sessionRewards, sponsorMultiplier, streakMultiplier } from "../lib/game";
import { fmtClock, fmtMin, fmtTime, isoDay, subjectColor } from "../lib/utils";
import { ask } from "../components/confirm";
import { Field, Seg, SubjectSelect, DurationInput, Modal } from "../components/ui";

export default function Focus() {
  const s = useStore();
  const { timer, settings, tasks, sessions, evals, grades, club } = s;
  const [mode, setMode] = useState<TimerState["mode"]>(timer.mode);
  const [target, setTarget] = useState(settings.pomodoroWork);
  const recos = useMemo(() => recommend(tasks, evals, grades), [tasks, evals, grades]);
  const [taskId, setTaskId] = useState<string>(timer.taskId ?? recos[0]?.task.id ?? "");
  const [subject, setSubject] = useState(settings.subjects[0] ?? "Maths");
  const [manual, setManual] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [timer.status]);

  useEffect(() => {
    if (mode === "pomodoro") setTarget(settings.pomodoroWork);
  }, [mode, settings.pomodoroWork]);

  const running = timer.status !== "idle";
  const el = timerElapsedMs(timer) / 1000;
  const total = (running ? timer.targetMin : target) * 60;
  const isFree = (running ? timer.mode : mode) === "free";
  const shown = running ? (isFree ? el : total - el) : isFree ? 0 : total;
  const progress = running ? (isFree ? (el % 3600) / 3600 : Math.min(1, el / total)) : 0;
  const task = tasks.find((t) => t.id === (running ? timer.taskId : taskId));
  const streak = currentStreak(sessions);
  const perMin = sessionRewards(1, { streak: streak + 1, staffLevel: club.facilities.staff });
  const todaySessions = sessions.filter((x) => isoDay(x.start) === isoDay(new Date())).sort((a, b) => b.start.localeCompare(a.start));
  const today = minutesByDay(sessions).get(isoDay(new Date())) ?? 0;
  const R = 140;
  const C = 2 * Math.PI * R;
  const color = timer.phase === "break" ? "var(--blue)" : "var(--accent)";

  return (
    <>
      <h1 className="page-title">Mode focus</h1>
      <p className="page-sub">Chaque minute travaillée = XP pour toi + budget et entraînement pour ton club. Toutes les 90 min, un match se débloque.</p>
      <div className="grid g2">
        <div className="card">
          {!running && (
            <div className="stack" style={{ marginBottom: 10 }}>
              <Seg value={mode} onChange={setMode} options={[["pomodoro", "🍅 Pomodoro"], ["countdown", "⏳ Minuteur"], ["free", "⏱️ Chrono libre"]]} />
              <div className="form-grid">
                <Field label="Tâche">
                  <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                    <option value="">— Pas de tâche précise —</option>
                    {recos.map((r) => <option key={r.task.id} value={r.task.id}>[{r.task.subject}] {r.task.title}</option>)}
                  </select>
                </Field>
                {!taskId && <Field label="Matière"><SubjectSelect value={subject} onChange={setSubject} /></Field>}
                {mode !== "free" && (
                  <Field label="Durée (min)">
                    <input className="input" type="number" min={1} value={target} onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))} />
                  </Field>
                )}
              </div>
            </div>
          )}
          <div className="timer-wrap">
            <div className="ring">
              <svg viewBox="0 0 320 320">
                <circle cx="160" cy="160" r={R} stroke="var(--bg2)" strokeWidth="16" fill="none" />
                <circle cx="160" cy="160" r={R} stroke={color} strokeWidth="16" fill="none" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset .3s linear" }} />
              </svg>
              <div className="center">
                <div>
                  <div className="muted small">{timer.status === "paused" ? "EN PAUSE" : timer.phase === "break" && running ? "☕ PAUSE" : running ? "FOCUS" : "PRÊT"}</div>
                  <div className="time">{fmtClock(shown)}</div>
                  {task && <div className="small" style={{ maxWidth: 200, margin: "0 auto" }}><span className="dot" style={{ background: subjectColor(task.subject) }} /> {task.title}</div>}
                  {running && timer.phase === "work" && (
                    <div className="small" style={{ color: "var(--gold)", marginTop: 6 }}>
                      +{Math.floor((el / 60) * perMin.xp)} XP · +{Math.floor((el / 60) * perMin.coins)} k€
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
            {!running && (
              <button className="btn primary big" onClick={() => {
                if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
                s.startTimer({ mode, targetMin: target, taskId: taskId || undefined, subject: taskId ? tasks.find((t) => t.id === taskId)?.subject : subject });
              }}>
                ▶ Démarrer
              </button>
            )}
            {timer.status === "running" && <button className="btn big" onClick={s.pauseTimer}>⏸ Pause</button>}
            {timer.status === "paused" && <button className="btn primary big" onClick={s.resumeTimer}>▶ Reprendre</button>}
            {running && (
              <button className="btn big" onClick={s.stopTimer}>{timer.phase === "break" ? "⏭ Fin de pause" : "⏹ Terminer"}</button>
            )}
            {running && <button className="btn ghost danger" onClick={async () => (await ask("Abandonner cette session sans la compter ?", { okLabel: "Abandonner", danger: true })) && s.cancelTimer()}>Abandonner</button>}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>💸 Tes gains actuels</h3>
            <div className="grid g3" style={{ gap: 10 }}>
              <div className="stat"><span className="v">{perMin.xp}</span><span className="l">XP / min</span></div>
              <div className="stat"><span className="v">{perMin.coins} k€</span><span className="l">Budget / min</span></div>
              <div className="stat"><span className="v">{fmtMin(today)}</span><span className="l">Aujourd'hui</span></div>
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>
              Série 🔥 ×{streakMultiplier(streak + 1).toFixed(2)} · Sponsors ×{sponsorMultiplier(club.facilities.staff).toFixed(2)} · la concentration notée en fin de session module de 0,8 à 1,2.
            </div>
          </div>
          <div className="card">
            <h3>Sessions du jour <span className="right"><button className="btn sm" onClick={() => setManual(true)}>+ Ajouter à la main</button></span></h3>
            {todaySessions.length === 0 ? (
              <div className="empty">Aucune session aujourd'hui. Lance-toi !</div>
            ) : (
              <div className="list">
                {todaySessions.map((x) => {
                  const t = tasks.find((y) => y.id === x.taskId);
                  return (
                    <div key={x.id} className="item">
                      <span className="subject-bar" style={{ background: subjectColor(x.subject ?? "") }} />
                      <div className="body">
                        <div className="title">{t?.title ?? x.subject ?? "Session libre"}</div>
                        <div className="meta">
                          <span className="pill">{fmtTime(x.start)}</span>
                          <span className="pill green">{fmtMin(x.minutes)}</span>
                          {x.focus && <span className="pill">{["😵", "😕", "😐", "🙂", "🔥"][x.focus - 1]}</span>}
                          <span className="pill gold">+{x.xp} XP</span>
                          {x.note && <span className="small muted">{x.note}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {manual && <ManualSession onClose={() => setManual(false)} />}
    </>
  );
}

function ManualSession({ onClose }: { onClose: () => void }) {
  const { tasks, logSession, settings } = useStore();
  const [minutes, setMinutes] = useState<number | undefined>(45);
  const [taskId, setTaskId] = useState("");
  const [subject, setSubject] = useState(settings.subjects[0] ?? "");
  const [focus, setFocus] = useState(3);
  return (
    <Modal
      title="Ajouter une session oubliée"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!minutes} onClick={() => { logSession({ minutes: minutes!, taskId: taskId || undefined, subject: taskId ? undefined : subject, focus }); onClose(); }}>Ajouter</button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>Pour être honnête avec ton club, ne déclare que du vrai travail 😉 (concentration par défaut 3/5).</p>
        <Field label="Durée"><DurationInput value={minutes} onChange={setMinutes} /></Field>
        <Field label="Tâche">
          <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— Pas de tâche précise —</option>
            {tasks.filter((t) => !t.done).map((t) => <option key={t.id} value={t.id}>[{t.subject}] {t.title}</option>)}
          </select>
        </Field>
        {!taskId && <Field label="Matière"><SubjectSelect value={subject} onChange={setSubject} /></Field>}
        <Field label="Concentration">
          <Seg value={focus} onChange={setFocus} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
        </Field>
      </div>
    </Modal>
  );
}
