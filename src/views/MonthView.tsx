/** MOIS : calendrier complet, échéances, charge de chaque jour par catégorie, objectifs du mois. */
import { useMemo, useState } from "react";
import { DAY_SHORT, MONTHS, addDays, addMonths, daysBetween, mondayOf, monthEnd, monthStart, parse, range, today } from "../lib/dates";
import { expand, goalTarget, goalValue, moveOccurrence, type Occ } from "../lib/model";
import { fmtGoal } from "../lib/review";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { Bar, useCats } from "../components/common";

export default function MonthView() {
  const date = useStore((s) => s.date);
  const plan = useStore((s) => s.plan);
  const go = useStore((s) => s.go);
  const apply = useStore((s) => s.apply);
  const open = useUI((s) => s.open);
  const cats = useCats();
  const t = today();
  const m0 = monthStart(date);
  const m1 = monthEnd(date);
  const gridStart = mondayOf(m0);
  const gridEnd = addDays(mondayOf(m1), 6);
  const days = useMemo(() => range(gridStart, gridEnd), [gridStart, gridEnd]);
  const occs = useMemo(() => expand(plan, gridStart, gridEnd), [plan, gridStart, gridEnd]);
  const byDay = useMemo(() => {
    const m = new Map<string, Occ[]>();
    for (const o of occs) m.set(o.date, [...(m.get(o.date) ?? []), o]);
    return m;
  }, [occs]);
  const [over, setOver] = useState<string | null>(null);
  const month = parse(m0);
  const nDays = daysBetween(m0, m1) + 1;

  const drop = (d: string, key: string) => {
    setOver(null);
    const o = occs.find((x) => x.key === key);
    if (!o || o.date === d) return;
    apply((p) => moveOccurrence(p, key, d), `« ${o.title} » déplacé au ${parse(d).getDate()}${o.series ? " (cette occurrence)" : ""}`);
  };

  const monthGoals = plan.goals.filter((g) => g.period !== "total");
  const deadlines = occs.filter((o) => o.deadline && o.date >= m0 && o.date <= m1);

  return (
    <div className="month">
      <header className="view-head">
        <div>
          <span className="eyebrow">{month.getFullYear()}</span>
          <h1 className="view-title cap">{MONTHS[month.getMonth()]}</h1>
        </div>
        <div className="row">
          <button className="icon-btn" aria-label="Mois précédent" onClick={() => go("mois", addMonths(m0, -1))}>‹</button>
          {m0 !== monthStart(t) && <button className="btn sm ghost" onClick={() => go("mois", t)}>Ce mois-ci</button>}
          <button className="icon-btn" aria-label="Mois suivant" onClick={() => go("mois", addMonths(m0, 1))}>›</button>
        </div>
      </header>

      <div className="month-layout">
        <section className="cal">
          <div className="cal-head">{DAY_SHORT.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cal-grid">
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const work = list.filter((o) => o.check);
              const totalMin = work.reduce((s, o) => s + o.minutes, 0);
              const doneMin = work.reduce((s, o) => s + (o.done?.minutes ?? 0), 0);
              const segs = new Map<string, number>();
              for (const o of work) segs.set(o.cat, (segs.get(o.cat) ?? 0) + o.minutes);
              const chips = list.filter((o) => o.deadline || !o.series).filter((o) => o.cat !== "vie");
              const out = d < m0 || d > m1;
              return (
                <div
                  key={d}
                  className={`cal-day ${out ? "out" : ""} ${d === t ? "today" : ""} ${over === d ? "over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(d); }}
                  onDragLeave={() => setOver((x) => (x === d ? null : x))}
                  onDrop={(e) => { e.preventDefault(); drop(d, e.dataTransfer.getData("text/plain")); }}
                >
                  <button className="cal-num" onClick={() => go("jour", d)} aria-label={`Ouvrir le ${parse(d).getDate()}`}>{parse(d).getDate()}</button>
                  {totalMin > 0 && (
                    <div className="cal-load" title={`${Math.round(totalMin / 6) / 10} h prévues`}>
                      {[...segs.entries()].map(([c, m]) => <span key={c} style={{ flex: m, background: cats.get(c)?.color }} />)}
                    </div>
                  )}
                  {totalMin > 0 && d <= t && <div className="cal-done"><span style={{ width: `${Math.min(100, (doneMin / totalMin) * 100)}%` }} /></div>}
                  <div className="cal-chips">
                    {chips.slice(0, 3).map((o) => (
                      <button
                        key={o.key}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", o.key)}
                        className={`cal-chip ${o.deadline ? "deadline" : ""} ${o.done ? "done" : ""}`}
                        style={{ ["--c" as string]: cats.get(o.cat)?.color }}
                        onClick={() => open({ kind: "item", key: o.key })}
                        title={o.title}
                      >
                        {o.deadline && "⚑ "}{o.title}
                      </button>
                    ))}
                    {chips.length > 3 && <button className="cal-more" onClick={() => go("jour", d)}>+{chips.length - 3}</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend">
            {plan.categories.filter((c) => c.tracked).map((c) => <span key={c.id}><span className="dot" style={{ background: c.color }} />{c.name}</span>)}
          </div>
          <p className="muted small hint">La barre de couleur montre le travail prévu du jour par matière ; la barre verte, la part validée. Glisse une échéance ou une tâche vers un autre jour pour la déplacer.</p>
        </section>

        <aside className="month-side">
          <section className="card">
            <h3 className="h3">Objectifs du mois</h3>
            <p className="muted small">Les objectifs hebdo, ramenés à ce mois ({nDays} jours). Validé uniquement.</p>
            <ul className="goals">
              {monthGoals.map((g) => {
                const v = goalValue(plan, g, m0, m1);
                const target = goalTarget(g, nDays);
                const c = g.cat ? cats.get(g.cat) : undefined;
                return (
                  <li key={g.id}>
                    <div className="goal-top"><span><span className="dot" style={{ background: c?.color ?? "var(--orange)" }} />{g.label}</span><b className={v >= target ? "ok" : ""}>{fmtGoal(Math.round(v * 10) / 10, g.unit)} / {fmtGoal(target, g.unit)}</b></div>
                    <Bar value={v} max={target} color={c?.color} thin />
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card">
            <h3 className="h3">Échéances du mois</h3>
            {deadlines.length === 0 ? <p className="muted small">Aucune.</p> : (
              <ul className="dl-list">
                {deadlines.map((o) => (
                  <li key={o.key}><button onClick={() => go("jour", o.date)}><span className={`dl-count ${o.date < t ? "past" : ""}`}>{parse(o.date).getDate()}</span><span>{o.title}</span></button></li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
