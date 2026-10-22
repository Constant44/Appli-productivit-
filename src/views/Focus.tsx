import { useEffect, useMemo, useState } from "react";
import { timerElapsedMs, useStore, type TimerState } from "../lib/store";
import { currentStreak, minutesByDay, recommend } from "../lib/insights";
import { sessionRewards, sponsorMultiplier, streakMultiplier } from "../lib/game";
import { fmtClock, fmtMin, fmtTime, isoDay, subjectColor } from "../lib/utils";
import { ask } from "../components/confirm";
import { Field, Seg, SubjectSelect, DurationInput, Modal } from "../components/ui";
import { Rat } from "../components/Mascot";

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

  const start = () => {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    s.startTimer({ mode, targetMin: target, taskId: taskId || undefined, subject: taskId ? tasks.find((t) => t.id === taskId)?.subject : subject });
  };
  const brk = running && timer.phase === "break";

  if (running)
    return (
      <div className={`focus-stage ${brk ? "brk" : ""} ${timer.status === "paused" ? "paused" : ""}`}>
        <div className="eyebrow">{timer.status === "paused" ? "En pause" : brk ? "☕ Pause" : "Focus"}{task ? ` · ${task.subject}` : timer.subject ? ` · ${timer.subject}` : ""}</div>
        <div className="focus-time">{fmtClock(shown)}</div>
        {task && <div className="focus-task">{task.title}</div>}
        <div className="track" aria-hidden>
          <div className="track-line" />
          <svg className="goal" viewBox="0 0 40 60"><rect x="4" y="4" width="32" height="52" fill="none" stroke="#fff" strokeWidth="3" /><path d="M8 8 L32 52 M32 8 L8 52 M8 20 H32 M8 32 H32 M8 44 H32" stroke="#ffffff55" strokeWidth="1" /></svg>
          <div className="runner-rat" style={{ left: `calc(${(brk ? 0.5 : progress) * 100}% * 0.82)` }}>
            <Rat mood={brk ? "sleep" : timer.status === "paused" ? "idle" : "run"} size={84} jersey={club.colorA} trim={club.colorB} />
            {!brk && <span className="track-ball" />}
          </div>
        </div>
        {!brk && (
          <div className="focus-gains">+{Math.floor((el / 60) * perMin.xp)} XP · +{Math.floor((el / 60) * perMin.coins)} k€ · {fmtMin(today)} aujourd'hui</div>
        )}
        <div className="row" style={{ justifyContent: "center" }}>
          {timer.status === "running" && <button className="btn big" onClick={s.pauseTimer}>⏸ Pause</button>}
          {timer.status === "paused" && <button className="btn primary big" onClick={s.resumeTimer}>▶ Reprendre</button>}
          <button className="btn big" onClick={s.stopTimer}>{brk ? "⏭ Fin de pause" : "⏹ Terminer"}</button>
        </div>
        <button className="btn sm ghost danger" style={{ marginTop: 6 }} onClick={async () => (await ask("Abandonner cette session sans la compter ?", { okLabel: "Abandonner", danger: true })) && s.cancelTimer()}>Abandonner</button>
      </div>
    );

  return (
    <>
      <h1 className="page-title">Focus</h1>
      <p className="page-sub">Chaque minute = XP pour toi, budget et entraînement pour le club. Toutes les 90 min, un match se débloque.</p>
      <div className="grid g2">
        <div className="card stack" style={{ gap: 14 }}>
          <Seg value={mode} onChange={setMode} options={[["pomodoro", "🍅 Pomodoro"], ["countdown", "⏳ Minuteur"], ["free", "⏱️ Chrono libre"]]} />
          <Field label="Sur quoi ?">
            <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">— Pas de tâche précise —</option>
              {recos.map((r) => <option key={r.task.id} value={r.task.id}>[{r.task.subject}] {r.task.title}</option>)}
            </select>
          </Field>
          {!taskId && <Field label="Matière"><SubjectSelect value={subject} onChange={setSubject} /></Field>}
          {mode !== "free" && (
            <div className="row" style={{ gap: 6 }}>
              {[25, 30, 45, 60, 90].map((m) => <button key={m} className={`btn sm ${target === m ? "primary" : ""}`} onClick={() => setTarget(m)}>{m} min</button>)}
              <input className="input" type="number" min={1} value={target} onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))} style={{ width: 80 }} aria-label="Durée en minutes" />
            </div>
          )}
          <div className="focus-preview">
            <Rat mood="idle" size={92} jersey={club.colorA} trim={club.colorB} />
            <div>
              <div className="focus-time sm">{mode === "free" ? "00:00" : fmtClock(target * 60)}</div>
              <div className="small muted">{task ? task.title : "Session libre"}</div>
            </div>
          </div>
          <button className="btn primary big" style={{ justifyContent: "center" }} onClick={start}>▶ Démarrer</button>
        </div>

        <div className="stack">
          <div className="card">
            <h3>💸 Tes gains</h3>
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
