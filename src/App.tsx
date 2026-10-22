import { useEffect, useMemo, useState } from "react";
import { EDHEC_SUBJECTS, timerElapsedMs, useStore } from "./lib/store";
import { levelFromXp, levelTitle } from "./lib/game";
import { currentStreak } from "./lib/insights";
import { daysUntil, fmtClock, fmtMoney, isoDay } from "./lib/utils";
import { Modal, Toasts } from "./components/ui";
import { ConfirmHost } from "./components/confirm";
import { Celebration } from "./components/Celebration";
import { StudyHub, AgendaHub } from "./views/Hubs";
import { useDevice } from "./lib/device";
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

export type View = "home" | "study" | "agenda" | "warmup" | "focus" | "tasks" | "edhec" | "vendredi" | "plan" | "evals" | "tt" | "grades" | "club" | "stats" | "settings";

type SectionId = "today" | "focus" | "study" | "agenda" | "city";
/** 5 rubriques seulement ; les écrans d'une rubrique sont des onglets en haut de page. */
const SECTIONS: Array<{ id: SectionId; label: string; icon: keyof typeof ICONS; views: Array<[View, string]> }> = [
  { id: "today", label: "Aujourd'hui", icon: "home", views: [["home", "Aujourd'hui"]] },
  { id: "focus", label: "Focus", icon: "timer", views: [["focus", "Focus"]] },
  { id: "study", label: "Réviser", icon: "book", views: [["study", "Bibliothèque"], ["warmup", "Échauffement"], ["vendredi", "Test du vendredi"], ["edhec", "EDHEC"], ["plan", "Planning"]] },
  { id: "agenda", label: "Agenda", icon: "cal", views: [["agenda", "Bureau du coach"], ["tasks", "To-do"], ["evals", "DS & khôlles"], ["tt", "Emploi du temps"], ["grades", "Notes"]] },
  { id: "city", label: "Ville", icon: "city", views: [["club", "Prépa City"], ["stats", "Stats"]] },
];
const ALL_VIEWS: View[] = [...SECTIONS.flatMap((s) => s.views.map(([v]) => v)), "settings"];
const sectionOf = (v: View) => SECTIONS.find((s) => s.views.some(([x]) => x === v));

const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  timer: "M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  cal: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 2v4M15 2v4",
  city: "M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13M13 9h3M13 13h3M13 17h3M7 12h1M7 16h1",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};
export const Icon = ({ name, size = 22 }: { name: keyof typeof ICONS; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
);

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
  return ALL_VIEWS.includes(v) ? v : "home";
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

/**
 * Raccourcis clavier (Mac) : 1 à 5 = rubriques, Espace = démarrer / mettre en pause le chrono sur l'écran Focus,
 * N = nouvelle tâche, ← → = onglet précédent / suivant de la rubrique.
 */
function useShortcuts(view: View) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]") || document.querySelector(".modal-bg")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SECTIONS.length) return navigate(SECTIONS[n - 1].views[0][0]);
      const sec = sectionOf(view);
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && sec && sec.views.length > 1) {
        const i = sec.views.findIndex(([v]) => v === view);
        const j = (i + (e.key === "ArrowRight" ? 1 : -1) + sec.views.length) % sec.views.length;
        return navigate(sec.views[j][0]);
      }
      if (e.key === "n" || e.key === "N") {
        navigate("tasks");
        setTimeout(() => (document.querySelector("input[placeholder^='Ajout rapide']") as HTMLInputElement | null)?.focus(), 80);
        return;
      }
      if (e.key === " " && view === "focus") {
        e.preventDefault();
        const st = useStore.getState();
        if (st.timer.status === "running") st.pauseTimer();
        else if (st.timer.status === "paused") st.resumeTimer();
        else (document.querySelector(".focus-start") as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);
}

function TopBar() {
  const { xp, coins, sessions, timer } = useStore();
  const lv = levelFromXp(xp);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [timer.status]);
  const el = timerElapsedMs(timer) / 1000;
  const cloud = useCloud();
  const pct = Math.round((lv.into / lv.need) * 100);
  return (
    <div className="topbar">
      <div className="lvl" title={`${xp} XP au total · ${lv.into}/${lv.need} vers le niveau ${lv.level + 1}`}>
        <div className="lvl-ring" style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--line) 0)` }}><span>{lv.level}</span></div>
        <div className="info"><b>{levelTitle(lv.level)}</b><span className="muted small">{lv.into}/{lv.need} XP</span></div>
      </div>
      <span className="spacer" />
      {timer.status !== "idle" && (
        <button className="chip click timer-chip" onClick={() => navigate("focus")} data-phase={timer.phase}>
          {timer.status === "paused" ? "⏸" : timer.phase === "break" ? "☕" : "●"} {timer.mode === "free" ? fmtClock(el) : fmtClock(timer.targetMin * 60 - el)}
        </button>
      )}
      <span className="chip" title="Budget du club">💰 {fmtMoney(coins)}</span>
      <span className="chip" title="Série de jours avec au moins 25 min de travail">🔥 {streak}</span>
      {cloud.status !== "local" && (
        <span className={`cloud-dot ${cloud.status}`} title={cloud.message ?? (cloud.status === "synced" ? "Sauvegardé dans ton compte claude.ai" : cloud.status === "saving" ? "Sauvegarde…" : cloud.status === "connecting" ? "Connexion…" : "En attente de sauvegarde")} />
      )}
      <button className="icon-btn" aria-label="Réglages" onClick={() => navigate("settings")}><Icon name="gear" size={20} /></button>
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

  const section = sectionOf(view);
  const device = useDevice();
  useShortcuts(view);
  const badge = (id: SectionId) =>
    id === "agenda" ? overdue + soonEvals : id === "study" ? (warmedUp ? 0 : 1) : 0;

  return (
    <div className="app" data-section={section?.id ?? "settings"} data-device={device}>
      <nav className="sidebar">
        <div className="brand"><span className="ball">⚽</span> Prépa FC</div>
        {SECTIONS.map((sec, i) => (
          <button key={sec.id} className={`nav-btn ${section?.id === sec.id ? "active" : ""}`} onClick={() => navigate(sec.views[0][0])}>
            <Icon name={sec.icon} />
            <span>{sec.label}</span>
            {badge(sec.id) > 0 ? <span className="badge">{badge(sec.id)}</span> : <span className="kbd">{i + 1}</span>}
          </button>
        ))}
      </nav>
      <div className="main">
        <TopBar />
        <div className="content" key={view}>
          {section && section.views.length > 1 && section.views[0][0] !== view && (
            <div className="backbar">
              <button className="back" onClick={() => navigate(section.views[0][0])}>‹ {section.views[0][1]}</button>
            </div>
          )}
          {view === "settings" && (
            <div className="backbar"><button className="back" onClick={() => navigate("home")}>‹ Aujourd'hui</button></div>
          )}
          {view === "home" && <Dashboard />}
          {view === "study" && <StudyHub />}
          {view === "agenda" && <AgendaHub />}
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
      <Celebration />
    </div>
  );
}
