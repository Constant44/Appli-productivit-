import { useEffect, useMemo } from "react";
import { addDays, addMonths, daysBetween, fromMin, nowMin, today } from "./lib/dates";
import { streak } from "./lib/coach";
import { useFocus } from "./lib/focus";
import { useRun } from "./lib/runSession";
import { expand } from "./lib/model";
import { useStore, type View } from "./lib/store";
import { useUI } from "./lib/ui";
import SheetHost from "./components/Sheets";
import FocusOverlay from "./components/FocusOverlay";
import Logo from "./components/Logo";
import DayView from "./views/DayView";
import WeekView from "./views/WeekView";
import MonthView from "./views/MonthView";
import YearView from "./views/YearView";
import FridayView from "./views/FridayView";
import RunView from "./views/RunView";
import RunOverlay from "./components/RunOverlay";

const TABS: Array<[View, string, string]> = [["jour", "Journée", "J"], ["semaine", "Semaine", "S"], ["mois", "Mois", "M"], ["annee", "Année", "A"]];
const EDHEC = "2027-04-03";

export default function App() {
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);
  const date = useStore((s) => s.date);
  const plan = useStore((s) => s.plan);
  const cloud = useStore((s) => s.cloud);
  const toasts = useStore((s) => s.toasts);
  const undo = useStore((s) => s.undo);
  const dismiss = useStore((s) => s.dismiss);
  const open = useUI((s) => s.open);
  const sheet = useUI((s) => s.sheet);
  const focus = useFocus((f) => f.session);
  const running = useRun((r) => !!r.active);
  const startFocus = useFocus((f) => f.start);
  const t = today();
  const days = useMemo(() => streak(plan, t), [plan, t]);
  const left = daysBetween(t, EDHEC);

  useEffect(() => {
    const h = location.hash.replace("#", "") as View;
    if (["jour", "semaine", "mois", "annee", "vendredi", "course"].includes(h)) go(h);
  }, [go]);
  useEffect(() => {
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  }, [view]);

  const addNow = () => {
    const n = Math.ceil(nowMin() / 15) * 15;
    open({ kind: "new", defaults: { date: view === "jour" ? date : today(), start: fromMin(Math.min(n, 22 * 60)), end: fromMin(Math.min(n + 45, 23 * 60)) } });
  };
  const focusNext = () => {
    const n = nowMin();
    const occ = expand(plan, t, t).find((o) => o.check && !o.done && o.start && Number(o.end?.slice(0, 2)) * 60 + Number(o.end?.slice(3)) > n);
    if (occ) startFocus(occ);
  };

  // raccourcis clavier (Mac)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || sheet || focus || running) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      const step = (dir: number) => {
        if (view === "jour") go("jour", addDays(date, dir));
        else if (view === "semaine") go("semaine", addDays(date, 7 * dir));
        else if (view === "mois") go("mois", addMonths(date, dir));
      };
      const map: Record<string, () => void> = {
        j: () => go("jour"), s: () => go("semaine"), m: () => go("mois"), a: () => go("annee"), v: () => go("vendredi"), c: () => go("course"),
        t: () => go(["vendredi", "annee", "course"].includes(view) ? "jour" : view, today()), n: addNow, f: focusNext,
        r: () => open({ kind: "replan", date: today() }), "?": () => open({ kind: "help" }),
        arrowleft: () => step(-1), arrowright: () => step(1),
      };
      if (map[k]) {
        e.preventDefault();
        map[k]();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go("jour", today())} aria-label="Cadence, aujourd'hui"><Logo size={30} /><span>Cadence</span></button>
        <nav className="tabs" aria-label="Vues">
          {TABS.map(([v, l, key]) => <button key={v} className={view === v ? "on" : ""} onClick={() => go(v)} title={`Raccourci : ${key}`}>{l}</button>)}
          <button className={`chill run-tab ${view === "course" ? "on" : ""}`} onClick={() => go("course")} title="Raccourci : C">Course</button>
          <button className={`chill ${view === "vendredi" ? "on" : ""}`} onClick={() => go("vendredi")} title="Raccourci : V">Vendredi</button>
        </nav>
        <div className="top-actions">
          <span className="chip-stat" title="Jours d'affilée avec au moins 60 % des séances importantes validées"><b>{days}</b> j tenus</span>
          <span className="chip-stat edhec" title="Écrits EDHEC le 3 avril 2027"><b>J-{left}</b> EDHEC</span>
          <span className={`sync ${cloud.status}`} title={cloud.msg ?? (cloud.status === "ok" ? "Enregistré dans ton compte" : "Synchronisation")} aria-label="État de la sauvegarde" />
          <button className="icon-btn" aria-label="Aide" onClick={() => open({ kind: "help" })}>?</button>
          <button className="icon-btn" aria-label="Réglages" onClick={() => open({ kind: "settings" })}>⚙</button>
          <button className="btn primary add" onClick={addNow}>+ Ajouter</button>
        </div>
      </header>
      {cloud.status === "error" && <div className="banner">{cloud.msg}</div>}

      <main className="main">
        {view === "jour" && <DayView />}
        {view === "semaine" && <WeekView />}
        {view === "mois" && <MonthView />}
        {view === "annee" && <YearView />}
        {view === "vendredi" && <FridayView />}
        {view === "course" && <RunView />}
      </main>

      <FocusOverlay />
      <RunOverlay />
      <SheetHost />
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.tone ?? "ok"}`}>
            <span>{x.text}</span>
            {x.undo && <button onClick={() => { undo(); dismiss(x.id); }}>Annuler</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
