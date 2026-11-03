/** Planning : le programme des 7 prochains jours, les épreuves à venir, et l'accès à l'agenda. */
import { useStore } from "../lib/store";
import { AskTopicsCard, ProgramCard } from "../components/Program";
import { fmtDay, fmtRelDay, fmtTime } from "../lib/utils";
import { navigate, type View } from "../App";

export default function Planning() {
  const evals = useStore((s) => s.evals);
  const upcoming = evals.filter((e) => +new Date(e.date) >= Date.now() - 36e5).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const links: Array<[View, string, string]> = [["tasks", "📌", "To-do"], ["evals", "📝", "DS & khôlles"], ["tt", "📅", "Emploi du temps"], ["grades", "📊", "Notes"]];
  return (
    <div className="planning">
      <h1 className="page-title">Planning</h1>
      <ProgramCard openWeek />
      <AskTopicsCard />
      <section className="card" style={{ marginBottom: 16 }}>
        <h3>Prochaines épreuves</h3>
        {upcoming.length === 0 ? <div className="empty">Rien de prévu.</div> : (
          <div className="list">
            {upcoming.map((e) => (
              <div key={e.id} className="coach-row">
                <span className={`pill ${e.type === "DS" ? "red" : "purple"}`}>{e.type}</span>
                <span className="coach-row-t">{e.subject}{e.topic ? ` · ${e.topic}` : ""}</span>
                <span className="small muted">{fmtDay(e.date)} {fmtTime(e.date)} · {fmtRelDay(e.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="more-grid">
        {links.map(([v, ico, label]) => <button key={v} className="more-tile" onClick={() => navigate(v)}><span>{ico}</span><b>{label}</b></button>)}
      </div>
    </div>
  );
}
