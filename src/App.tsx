import { useEffect, useMemo, useState } from "react";
import { EDHEC_SUBJECTS, timerElapsedMs, useStore } from "./lib/store";
import { MATCH_COST_MIN, levelFromXp, levelTitle } from "./lib/game";
import { currentStreak, minutesByDay } from "./lib/insights";
import { daysUntil, fmtClock, fmtMoney, isoDay } from "./lib/utils";
import { Bar, Modal, Toasts } from "./components/ui";
import { ConfirmHost } from "./components/confirm";
import { useCloud } from "./lib/platform";
import Dashboard from "./views/Dashboard";
import Focus from "./views/Focus";
import Tasks from "./views/Tasks";
import Planner from "./views/Planner";
import Evals from "./views/Evals";
import Timetable from "./views/Timetable";
import Grades from "./views/Grades";
import ClubView from "./views/Club";
import Stats from "./views/Stats";
import Settings from "./views/Settings";
import Edhec from "./views/Edhec";
import Vendredi from "./views/Vendredi";
import Warmup from "./views/Warmup";

export type View = "home" | "warmup" | "focus" | "tasks" | "edhec" | "vendredi" | "plan" | "evals" | "tt" | "grades" | "club" | "stats" | "settings";

const NAV: Array<[View, string, string]> = [
  ["home", "🏠", "QG"],
  ["warmup", "🔥", "Échauffement"],
  ["focus", "⏱️", "Focus"],
  ["tasks", "✅", "To-do"],
  ["edhec", "🎯", "Objectif EDHEC"],
  ["vendredi", "🗞️", "Test du vendredi"],
  ["plan", "🗓️", "Révisions"],
  ["evals", "📝", "DS & khôlles"],
  ["tt", "📅", "Emploi du temps"],
  ["grades", "📊", "Notes"],
  ["club", "⚽", "Mon club"],
  ["stats", "📈", "Stats"],
  ["settings", "⚙️", "Pronote & réglages"],
];

export const navigate = (v: View) => {
  window.location.hash = v;
};

function useHashView(): View {
  const read = () => (window.location.hash.slice(1) as View) || "home";
  const [v, setV] = useState<View>(read);
  useEffect(() => {
    const f = () => setV(read());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return NAV.some(([k]) => k === v) ? v : "home";
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = [660, 880, 990][i];
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {
    /* audio indisponible */
  }
}

/** Surveille le timer : titre de l'onglet, fin automatique des pomodoros et des pauses. */
function TimerWatcher() {
  const timer = useStore((s) => s.timer);
  const sound = useStore((s) => s.settings.sound);
  useEffect(() => {
    if (timer.status !== "running") {
      document.title = "Prépa FC";
      return;
    }
    const id = setInterval(() => {
      const el = timerElapsedMs(timer) / 1000;
      const target = timer.targetMin * 60;
      const counting = timer.mode !== "free";
      document.title = `${counting ? fmtClock(target - el) : fmtClock(el)} · ${timer.phase === "break" ? "Pause" : "Focus"}`;
      if (counting && el >= target) {
        if (sound) beep();
        if ("Notification" in window && Notification.permission === "granted")
          new Notification(timer.phase === "break" ? "Pause terminée, on y retourne !" : "Session terminée 🎉");
        useStore.getState().stopTimer();
      }
    }, 500);
    return () => clearInterval(id);
  }, [timer, sound]);
  return null;
}

function PendingSessionModal() {
  const pending = useStore((s) => s.pending);
  const resolve = useStore((s) => s.resolvePending);
  const task = useStore((s) => s.tasks.find((t) => t.id === pending?.taskId));
  const [focus, setFocus] = useState(4);
  const [note, setNote] = useState("");
  if (!pending) return null;
  return (
    <Modal
      title={`🎉 ${pending.minutes} min de travail !`}
      onClose={() => resolve(focus, note)}
      actions={
        <>
          <button className="btn danger" onClick={() => resolve(null)}>Ne pas compter</button>
          <button className="btn primary" onClick={() => { resolve(focus, note); setNote(""); }}>Encaisser les gains</button>
        </>
      }
    >
      {task && <p className="muted" style={{ marginTop: 0 }}>Sur : <b style={{ color: "var(--text)" }}>{task.title}</b></p>}
      <p>Ta concentration sur cette session ? <span className="muted small">(influence les gains de ±20 %)</span></p>
      <div className="row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`btn ${focus === n ? "primary" : ""}`} onClick={() => setFocus(n)}>
            {["😵", "😕", "😐", "🙂", "🔥"][n - 1]} {n}
          </button>
        ))}
      </div>
      <input className="input" style={{ marginTop: 12 }} placeholder="Note rapide (optionnel) : ce que j'ai fait, ce qui a bloqué…" value={note} onChange={(e) => setNote(e.target.value)} />
      {pending.nextBreak && <p className="small muted">Une pause démarrera ensuite automatiquement.</p>}
    </Modal>
  );
}

function TopBar() {
  const { xp, coins, sessions, timer, club, settings } = useStore();
  const lv = levelFromXp(xp);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const today = minutesByDay(sessions).get(isoDay(new Date())) ?? 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [timer.status]);
  const matches = Math.floor(club.matchMinutesBank / MATCH_COST_MIN);
  const el = timerElapsedMs(timer) / 1000;
  const cloud = useCloud();
  return (
    <div className="topbar">
      <div className="lvl" title={`${xp} XP au total`}>
        <div className="num">{lv.level}</div>
        <div className="info">
          <div className="row between small"><b>{levelTitle(lv.level)}</b><span className="muted">{lv.into}/{lv.need} XP</span></div>
          <Bar value={lv.into} max={lv.need} />
        </div>
      </div>
      <span className="chip" title="Budget du club">💰 {fmtMoney(coins)}</span>
      <span className="chip" title="Série de jours ≥ 25 min">🔥 {streak} j</span>
      <span className="chip" title={`Objectif du jour : ${settings.dailyGoalMin} min`}>
        🎯 {Math.round(today)}/{settings.dailyGoalMin} min
      </span>
      {matches > 0 && <span className="chip click" onClick={() => navigate("club")} style={{ borderColor: "var(--accent)" }}>⚽ {matches} match{matches > 1 ? "s" : ""} dispo</span>}
      <span className="spacer" />
      {cloud.status !== "local" && (
        <span className="chip small" title={cloud.message ?? "Tes données sont sauvegardées dans ton compte claude.ai"} style={{ color: cloud.status === "error" ? "var(--red)" : "var(--muted)" }}>
          {cloud.status === "connecting" ? "☁️ connexion…" : cloud.status === "saving" ? "☁️ sauvegarde…" : cloud.status === "waiting" ? "☁️ en attente…" : cloud.status === "error" ? "⚠️ non sauvegardé" : "☁️ sauvegardé"}
        </span>
      )}
      {timer.status !== "idle" && (
        <span className="chip click" onClick={() => navigate("focus")} style={{ borderColor: timer.phase === "break" ? "var(--blue)" : "var(--accent)" }}>
          {timer.status === "paused" ? "⏸️" : timer.phase === "break" ? "☕" : "⏱️"} {timer.mode === "free" ? fmtClock(el) : fmtClock(timer.targetMin * 60 - el)}
        </span>
      )}
    </div>
  );
}

export default function App() {
  const view = useHashView();
  const subjects = useStore((s) => s.settings.subjects);
  useEffect(() => {
    // matières EDHEC toujours disponibles (données synchronisées d'une version antérieure)
    const missing = EDHEC_SUBJECTS.filter((x) => !subjects.includes(x));
    if (missing.length) useStore.getState().updateSettings({ subjects: [...subjects, ...missing] });
  }, [subjects]);
  const tasks = useStore((s) => s.tasks);
  const evals = useStore((s) => s.evals);
  const overdue = tasks.filter((t) => !t.done && t.due && daysUntil(t.due) < 0).length;
  const soonEvals = evals.filter((e) => { const d = daysUntil(e.date); return d >= 0 && d <= 3; }).length;
  const warmedUp = useStore((s) => s.warmups.includes(isoDay(new Date())));

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand"><span className="ball">⚽</span> Prépa FC</div>
        {NAV.map(([k, icon, label]) => (
          <button key={k} className={`nav-btn ${view === k ? "active" : ""}`} onClick={() => navigate(k)}>
            <span>{icon}</span>
            <span>{label}</span>
            {k === "tasks" && overdue > 0 && <span className="badge">{overdue}</span>}
            {k === "warmup" && !warmedUp && <span className="badge" style={{ background: "var(--accent)", color: "#04140a" }}>!</span>}
            {k === "evals" && soonEvals > 0 && <span className="badge" style={{ background: "var(--gold)", color: "#241500" }}>{soonEvals}</span>}
          </button>
        ))}
      </nav>
      <div className="main">
        <TopBar />
        <div className="content">
          {view === "home" && <Dashboard />}
          {view === "warmup" && <Warmup />}
          {view === "edhec" && <Edhec />}
          {view === "vendredi" && <Vendredi />}
          {view === "focus" && <Focus />}
          {view === "tasks" && <Tasks />}
          {view === "plan" && <Planner />}
          {view === "evals" && <Evals />}
          {view === "tt" && <Timetable />}
          {view === "grades" && <Grades />}
          {view === "club" && <ClubView />}
          {view === "stats" && <Stats />}
          {view === "settings" && <Settings />}
        </div>
      </div>
      <TimerWatcher />
      <PendingSessionModal />
      <ConfirmHost />
      <Toasts />
    </div>
  );
}
