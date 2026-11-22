import { useEffect } from "react";
import { fromMin, nowMin, today } from "./lib/dates";
import { useStore, type View } from "./lib/store";
import { useUI } from "./lib/ui";
import SheetHost from "./components/Sheets";
import DayView from "./views/DayView";
import WeekView from "./views/WeekView";
import MonthView from "./views/MonthView";
import YearView from "./views/YearView";
import FridayView from "./views/FridayView";

const TABS: Array<[View, string]> = [["jour", "Journée"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]];

export default function App() {
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);
  const date = useStore((s) => s.date);
  const cloud = useStore((s) => s.cloud);
  const toasts = useStore((s) => s.toasts);
  const undo = useStore((s) => s.undo);
  const dismiss = useStore((s) => s.dismiss);
  const open = useUI((s) => s.open);

  useEffect(() => {
    const h = location.hash.replace("#", "") as View;
    if (["jour", "semaine", "mois", "annee", "vendredi"].includes(h)) go(h);
  }, [go]);
  useEffect(() => {
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  }, [view]);

  const addNow = () => {
    const n = Math.ceil(nowMin() / 15) * 15;
    open({ kind: "new", defaults: { date: view === "jour" ? date : today(), start: fromMin(Math.min(n, 22 * 60)), end: fromMin(Math.min(n + 45, 23 * 60)) } });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden>▲</span><span>Prépa FC</span></div>
        <nav className="tabs" aria-label="Vues">
          {TABS.map(([v, l]) => <button key={v} className={view === v ? "on" : ""} onClick={() => go(v)}>{l}</button>)}
          <button className={`chill ${view === "vendredi" ? "on" : ""}`} onClick={() => go("vendredi")}>Vendredi</button>
        </nav>
        <div className="top-actions">
          <span className={`sync ${cloud.status}`} title={cloud.msg ?? (cloud.status === "ok" ? "Enregistré dans ton compte" : "Synchronisation")} aria-label="État de la sauvegarde" />
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
      </main>

      <SheetHost />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? "ok"}`}>
            <span>{t.text}</span>
            {t.undo && <button onClick={() => { undo(); dismiss(t.id); }}>Annuler</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
