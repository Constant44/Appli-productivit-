/** SEMAINE : grille sur 7 jours (glisser-déposer), objectifs hebdo, et le Bilan de la semaine. */
import { useMemo } from "react";
import { addDays, fmtDM, mondayOf, range, today } from "../lib/dates";
import { goalTarget, goalValue } from "../lib/model";
import { fmtGoal } from "../lib/review";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import TimeGrid from "../components/TimeGrid";
import { Bar, useCats } from "../components/common";
import Review from "./Review";

export default function WeekView() {
  const date = useStore((s) => s.date);
  const go = useStore((s) => s.go);
  const plan = useStore((s) => s.plan);
  const { weekTab, setWeekTab } = useUI();
  const cats = useCats();
  const week = mondayOf(date);
  const dates = useMemo(() => range(week, addDays(week, 6)), [week]);
  const goals = plan.goals.filter((g) => g.period === "semaine");
  const t = today();

  return (
    <div className="week">
      <header className="view-head">
        <div>
          <span className="eyebrow">{week === mondayOf(t) ? "Cette semaine" : week < mondayOf(t) ? "Semaine passée" : "Semaine à venir"}</span>
          <h1 className="view-title">Semaine du {fmtDM(week)} au {fmtDM(addDays(week, 6))}</h1>
        </div>
        <div className="row gap wrap">
          <div className="seg">
            <button className={weekTab === "planning" ? "on" : ""} onClick={() => setWeekTab("planning")}>Planning</button>
            <button className={weekTab === "bilan" ? "on" : ""} onClick={() => setWeekTab("bilan")}>Bilan de la semaine</button>
          </div>
          <div className="row">
            <button className="icon-btn" aria-label="Semaine précédente" onClick={() => go("semaine", addDays(week, -7))}>‹</button>
            {week !== mondayOf(t) && <button className="btn sm ghost" onClick={() => go("semaine", t)}>Cette semaine</button>}
            <button className="icon-btn" aria-label="Semaine suivante" onClick={() => go("semaine", addDays(week, 7))}>›</button>
          </div>
        </div>
      </header>

      {weekTab === "planning" ? (
        <div className="week-layout">
          <section className="week-grid">
            <TimeGrid dates={dates} ppm={0.9} compact />
            <p className="muted small hint">Glisse une séance pour la déplacer (sur iPad : par la poignée ⠿). Clique pour la valider, la modifier ou la reporter.</p>
          </section>
          <aside className="week-goals">
            <h3 className="h3">Objectifs de la semaine</h3>
            <p className="muted small">Seules les séances validées comptent.</p>
            <ul className="goals">
              {goals.map((g) => {
                const v = goalValue(plan, g, week, addDays(week, 6));
                const target = goalTarget(g, 7);
                const c = g.cat ? cats.get(g.cat) : undefined;
                return (
                  <li key={g.id}>
                    <div className="goal-top">
                      <span><span className="dot" style={{ background: c?.color ?? "var(--orange)" }} />{g.label}</span>
                      <b className={v >= target ? "ok" : ""}>{fmtGoal(Math.round(v * 10) / 10, g.unit)} / {fmtGoal(target, g.unit)}</b>
                    </div>
                    <Bar value={v} max={target} color={c?.color} thin />
                  </li>
                );
              })}
            </ul>
            <button className="btn add-wide" onClick={() => setWeekTab("bilan")}>Voir le bilan détaillé →</button>
          </aside>
        </div>
      ) : (
        <Review week={week} />
      )}
    </div>
  );
}
