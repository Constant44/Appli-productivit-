/** ANNÉE : la route jusqu'aux écrits EDHEC — régularité jour par jour, échéances, totaux, projets. */
import { useMemo } from "react";
import { MONTHS, addDays, addMonths, daysBetween, fmtDur, fmtLong, mondayOf, monthEnd, parse, range, today } from "../lib/dates";
import { expand } from "../lib/model";
import { useStore } from "../lib/store";
import { Bar, useCats } from "../components/common";

const SCHOOL_START = "2026-09-01";
const SCHOOL_END = "2027-06-30";

export default function YearView() {
  const plan = useStore((s) => s.plan);
  const go = useStore((s) => s.go);
  const cats = useCats();
  const t = today();
  const occs = useMemo(() => expand(plan, SCHOOL_START, SCHOOL_END), [plan]);
  const doneByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of occs) if (o.done) m.set(o.date, (m.get(o.date) ?? 0) + o.done.minutes);
    return m;
  }, [occs]);
  const deadlines = useMemo(() => new Set(occs.filter((o) => o.deadline).map((o) => o.date)), [occs]);
  const upcoming = occs.filter((o) => o.deadline && o.date >= t).slice(0, 10);
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of occs) if (o.done && cats.get(o.cat)?.tracked) m.set(o.cat, (m.get(o.cat) ?? 0) + o.done.minutes);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [occs, cats]);
  const maxTotal = totals[0]?.[1] ?? 1;
  const edhec = "2027-04-03";
  const daysLeft = daysBetween(t, edhec);
  const months = Array.from({ length: 10 }, (_, i) => addMonths(SCHOOL_START, i));
  const streak = (() => {
    let n = 0;
    for (let d = addDays(t, doneByDay.get(t) ? 0 : -1); doneByDay.get(d); d = addDays(d, -1)) n++;
    return n;
  })();

  return (
    <div className="year">
      <header className="year-hero">
        <div>
          <span className="eyebrow">Écrits EDHEC Pré-Master · {fmtLong(edhec)} 2027</span>
          <h1 className="year-count"><b>J-{daysLeft}</b></h1>
          <p className="muted">{Math.floor(daysLeft / 7)} semaines. Chaque case verte ci-dessous est un jour où tu as validé au moins une séance.</p>
        </div>
        <div className="year-kpis">
          <div className="kpi"><span>Série en cours</span><b className="lime">{streak} j</b></div>
          <div className="kpi"><span>Total validé</span><b>{fmtDur(totals.reduce((s, [, m]) => s + m, 0))}</b></div>
        </div>
      </header>

      <div className="year-layout">
        <section className="year-months">
          {months.map((m0) => {
            const start = mondayOf(m0);
            const days = range(start, addDays(mondayOf(monthEnd(m0)), 6));
            const mo = parse(m0);
            return (
              <button key={m0} className="ym" onClick={() => go("mois", m0)}>
                <span className="ym-name cap">{MONTHS[mo.getMonth()]} {mo.getFullYear() !== 2026 ? mo.getFullYear() : ""}</span>
                <span className="ym-grid">
                  {days.map((d) => {
                    const out = d.slice(0, 7) !== m0.slice(0, 7);
                    const min = doneByDay.get(d) ?? 0;
                    const lvl = min === 0 ? 0 : min < 90 ? 1 : min < 180 ? 2 : min < 300 ? 3 : 4;
                    return <span key={d} className={`yd l${lvl} ${out ? "out" : ""} ${d === t ? "today" : ""} ${deadlines.has(d) && !out ? "dl" : ""} ${d === edhec ? "goal" : ""}`} />;
                  })}
                </span>
              </button>
            );
          })}
          <div className="ym-legend"><span>Moins</span>{[0, 1, 2, 3, 4].map((l) => <span key={l} className={`yd l${l}`} />)}<span>Plus</span><span className="yd dl" /> <span>échéance</span></div>
        </section>

        <aside className="year-side">
          <section className="card">
            <h3 className="h3">Prochaines échéances</h3>
            <ul className="dl-list">
              {upcoming.map((o) => (
                <li key={o.key}><button onClick={() => go("jour", o.date)}><span className="dl-count">J-{daysBetween(t, o.date)}</span><span>{o.title}</span></button></li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h3 className="h3">Heures validées depuis le début</h3>
            {totals.length === 0 ? <p className="muted small">Valide tes premières séances : elles s'additionnent ici.</p> : (
              <ul className="goals">
                {totals.map(([c, m]) => (
                  <li key={c}><div className="goal-top"><span><span className="dot" style={{ background: cats.get(c)?.color }} />{cats.get(c)?.name}</span><b>{fmtDur(m)}</b></div><Bar value={m} max={maxTotal} color={cats.get(c)?.color} thin /></li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
