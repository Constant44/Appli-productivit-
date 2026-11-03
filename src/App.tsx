import { useEffect, useMemo, useState } from "react";
import { EDHEC_SUBJECTS, timerElapsedMs, useStore } from "./lib/store";
import { currentStreak } from "./lib/insights";
import { daysUntil, fmtClock, isoDay } from "./lib/utils";
import { Modal, Toasts } from "./components/ui";
import { ConfirmHost } from "./components/confirm";
import { Celebration } from "./components/Celebration";
import { syncCalendarAlarm } from "./lib/calAlarm";
import { knownPlaces } from "./lib/focusInsights";
import { StudyHub, AgendaHub } from "./views/Hubs";
import { useDevice } from "./lib/device";
import { useCloud } from "./lib/platform";
import Coach from "./views/Coach";
import Planning from "./views/Planning";
import More from "./views/More";
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

export type View = "home" | "planning" | "more" | "study" | "agenda" | "warmup" | "focus" | "tasks" | "edhec" | "vendredi" | "plan" | "evals" | "tt" | "grades" | "club" | "stats" | "settings";

type SectionId = "today" | "planning" | "more";
/** 3 rubriques : la consigne du moment, le planning, et tout le reste. */
const SECTIONS: Array<{ id: SectionId; label: string; icon: keyof typeof ICONS; views: Array<[View, string]> }> = [
  { id: "today", label: "Maintenant", icon: "home", views: [["home", "Maintenant"], ["focus", "Chrono"]] },
  { id: "planning", label: "Planning", icon: "cal", views: [["planning", "Planning"], ["tasks", "To-do"], ["evals", "DS & khôlles"], ["tt", "Emploi du temps"], ["grades", "Notes"]] },
  { id: "more", label: "Plus", icon: "grid", views: [["more", "Plus"], ["warmup", "Échauffement"], ["vendredi", "Test du vendredi"], ["edhec", "EDHEC"], ["plan", "Planning"], ["stats", "Stats"], ["club", "Prépa City"], ["study", "Bureau d'étude"], ["agenda", "Bureau du coach"], ["settings", "Réglages"]] },
];
const ALL_VIEWS: View[] = SECTIONS.flatMap((s) => s.views.map(([v]) => v));
const sectionOf = (v: View) => SECTIONS.find((s) => s.views.some(([x]) => x === v));

const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  timer: "M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  cal: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 2v4M15 2v4",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
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

/** Surveille le timer : titre de l'onglet, fin automatique des pomodoros et des pauses. */
function TimerWatcher() {
  const timer = useStore((s) => s.timer);
  const sound = useStore((s) => s.settings.sound);
  useEffect(() => syncCalendarAlarm(timer), [timer.status, timer.startedAt, timer.phase]);
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
        // pas de son (BU) : la fin est signalée par la notification Google Agenda
        try {
          if ("Notification" in window && Notification.permission === "granted")
            new Notification(timer.phase === "break" ? "Pause terminée, on y retourne !" : "Pomodoro terminé 🎉");
        } catch { /* notifications indisponibles dans la page */ }
        if (timer.phase === "break") useStore.getState().toast({ title: "⏰ Pause terminée", body: "On y retourne : ouvre « Maintenant » pour le bloc suivant.", tone: "good" });
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
  const sessions = useStore((s) => s.sessions);
  const task = useStore((s) => s.tasks.find((t) => t.id === pending?.taskId));
  const places = useMemo(() => knownPlaces(sessions), [sessions]);
  const [note, setNote] = useState("");
  const [focus10, setFocus10] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [other, setOther] = useState("");
  if (!pending) return null;
  const where = place === "__other" ? other.trim() || undefined : place ?? places[0];
  const finish = () => {
    // la note sur 10 donne aussi la note 1-5 des gains du jeu
    resolve(focus10 ? Math.max(1, Math.ceil(focus10 / 2)) : 4, note.trim() ? `Rappel : ${note.trim()}` : "", { focus10: focus10 ?? undefined, place: where });
    setNote(""); setFocus10(null); setPlace(null); setOther("");
  };
  return (
    <Modal
      title={`🎉 ${pending.minutes} min de travail !`}
      onClose={finish}
      actions={
        <>
          <button className="btn danger" onClick={() => resolve(null)}>Ne pas compter</button>
          <button className="btn primary" onClick={finish}>Valider</button>
        </>
      }
    >
      {task && <p className="muted" style={{ marginTop: 0 }}>Sur : <b style={{ color: "var(--text)" }}>{task.title}</b></p>}
      <p style={{ marginBottom: 6 }}><b>1 minute, sans regarder tes notes :</b> écris les 3 idées clés de ce que tu viens de travailler.</p>
      <p className="small muted" style={{ marginTop: 0 }}>Te forcer à te rappeler fixe bien mieux que relire.</p>
      <textarea id="recall-note" className="input" rows={3} placeholder="1. …  2. …  3. …" value={note} onChange={(e) => setNote(e.target.value)} />
      <p style={{ marginBottom: 6 }}><b>Ta concentration</b> <span className="small muted">sur 10</span></p>
      <div className="focus10" role="group" aria-label="Concentration sur 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={focus10 === n ? "on" : ""} style={{ ["--h" as string]: `${(n - 1) * 12}` }} onClick={() => setFocus10(n)}>{n}</button>
        ))}
      </div>
      <p style={{ marginBottom: 6 }}><b>Où es-tu ?</b></p>
      <div className="place-chips">
        {places.map((p) => (
          <button key={p} type="button" className={(place ?? places[0]) === p && place !== "__other" ? "on" : ""} onClick={() => setPlace(p)}>{p}</button>
        ))}
        <button type="button" className={place === "__other" ? "on" : ""} onClick={() => setPlace("__other")}>+ Autre</button>
      </div>
      {place === "__other" && <input id="place-other" className="input" style={{ marginTop: 8 }} autoFocus placeholder="ex : BU Montaigne, train…" value={other} onChange={(e) => setOther(e.target.value)} />}
      {pending.nextBreak && <p className="small muted">Une pause de {useStore.getState().settings.pomodoroBreak} min démarre ensuite : lève-toi, bois, pas d'écran.</p>}
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
        setTimeout(() => (document.querySelector("#todo-title") as HTMLInputElement | null)?.focus(), 80);
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
  const { sessions, timer } = useStore();
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [timer.status]);
  const el = timerElapsedMs(timer) / 1000;
  const cloud = useCloud();
  return (
    <div className="topbar">
      <div className="brand-top"><span className="ball">⚽</span> Prépa FC</div>
      <span className="spacer" />
      {timer.status !== "idle" && (
        <button className="chip click timer-chip" onClick={() => navigate("focus")} data-phase={timer.phase}>
          {timer.status === "paused" ? "⏸" : timer.phase === "break" ? "☕" : "●"} {timer.mode === "free" ? fmtClock(el) : fmtClock(timer.targetMin * 60 - el)}
        </button>
      )}
      <span className="chip" title="Série de jours avec au moins 25 min de travail">🔥 {streak}</span>
      {(
        <span role="button" tabIndex={0} onClick={() => navigate("settings")} className={`cloud-dot ${cloud.status}`} title={cloud.message ?? (cloud.status === "synced" ? "Sauvegardé dans ton compte claude.ai" : cloud.status === "saving" ? "Sauvegarde…" : cloud.status === "connecting" ? "Connexion…" : "En attente de sauvegarde")} />
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
    // « EDHEC Anglais » fusionnée dans « Anglais » : tâches et sessions renommées, matière retirée
    const st = useStore.getState();
    if (subjects.includes("EDHEC Anglais") || st.tasks.some((t) => t.subject === "EDHEC Anglais") || st.sessions.some((x) => x.subject === "EDHEC Anglais")) {
      const fix = <T extends { subject?: string }>(x: T): T => (x.subject === "EDHEC Anglais" ? { ...x, subject: "Anglais" } : x);
      useStore.setState({
        tasks: st.tasks.map(fix), sessions: st.sessions.map(fix),
        settings: { ...st.settings, subjects: [...new Set(subjects.filter((x) => x !== "EDHEC Anglais").concat(subjects.includes("Anglais") ? [] : ["Anglais"]))] },
      });
    }
  }, [subjects]);
  const tasks = useStore((s) => s.tasks);
  const evals = useStore((s) => s.evals);
  const overdue = tasks.filter((t) => !t.done && t.due && daysUntil(t.due) < 0).length;
  const soonEvals = evals.filter((e) => { const d = daysUntil(e.date); return d >= 0 && d <= 3; }).length;
  // Programme quotidien : recalculé quand un DS / une khôlle change, et chaque jour (après le chargement de la sauvegarde)
  const cloud = useCloud((c) => c.status);
  const evalSig = evals.map((e) => `${e.id}${e.date}${e.topic ?? ""}${e.durationMin ?? ""}`).join("|");
  const [day, setDay] = useState(isoDay(new Date()));
  useEffect(() => { const t = setInterval(() => setDay(isoDay(new Date())), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (cloud === "connecting" || (cloud === "waiting" && !useCloud.getState().lastSaved)) return;
    useStore.getState().regenerateProgram();
  }, [evalSig, day, cloud === "connecting"]);

  const section = sectionOf(view);
  const device = useDevice();
  useShortcuts(view);
  const badge = (id: SectionId) => (id === "planning" ? overdue + soonEvals : 0);

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
          {view === "home" && <Coach />}
          {view === "planning" && <Planning />}
          {view === "more" && <More />}
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
