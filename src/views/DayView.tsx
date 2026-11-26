/** JOURNÉE : ce que je dois faire aujourd'hui, à quelle heure, ce qui est fait, ce qui reste. */
import { useMemo, useState } from "react";
import { addDays, fmtDur, fmtLong, fmtShort, nowMin, toMin, today } from "../lib/dates";
import { expand, overdue, postpone, type Occ } from "../lib/model";
import { coachLine, essentials } from "../lib/coach";
import { useFocus } from "../lib/focus";
import { garminName, nextSession, sessionOf } from "../lib/run";
import { useRun } from "../lib/runSession";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import TimeGrid from "../components/TimeGrid";
import { EveningRoutine, MorningRoutine, routineNow } from "../components/RoutineCards";
import { useValidate } from "../components/RunLogSheet";
import { Ring, timeLabel, useCats } from "../components/common";

export default function DayView() {
  const plan = useStore((s) => s.plan);
  const date = useStore((s) => s.date);
  const go = useStore((s) => s.go);
  const apply = useStore((s) => s.apply);
  const open = useUI((s) => s.open);
  const startFocus = useFocus((f) => f.start);
  const focusOn = useFocus((f) => !!f.session);
  const runOn = useRun((r) => !!r.active);
  const validate = useValidate();
  const cats = useCats();
  // sur téléphone : emploi du temps ou tableau de bord (sur grand écran, les deux côte à côte)
  const [mTab, setMTab] = useState<"grid" | "board">(() => {
    try { return localStorage.getItem("cadence-day-tab") === "board" ? "board" : "grid"; } catch { return "grid"; }
  });
  const setTab = (v: "grid" | "board") => { setMTab(v); try { localStorage.setItem("cadence-day-tab", v); } catch { /* rien */ } };
  const t = today();
  const nextRun = useMemo(() => nextSession(plan.run, t), [plan.run, t]);
  const isToday = date === t;

  const occs = useMemo(() => expand(plan, date, date), [plan, date]);
  const late = useMemo(() => (isToday ? overdue(plan, t, 14) : []), [plan, t, isToday]);
  const tasks = occs.filter((o) => o.check);
  const fixed = occs.filter((o) => !o.check && !["vie", "libre"].includes(o.cat));
  const important = tasks.filter((o) => o.prio !== "facultatif");
  const optional = tasks.filter((o) => o.prio === "facultatif");
  const done = tasks.filter((o) => o.done);
  const progress = tasks.length ? done.length / tasks.length : 0;
  const doneMin = done.reduce((s, o) => s + o.done!.minutes, 0);
  const plannedMin = tasks.reduce((s, o) => s + o.minutes, 0);

  // maintenant / ensuite
  const n = nowMin();
  const current = isToday ? occs.find((o) => o.start && toMin(o.start) <= n && toMin(o.start) + o.minutes > n && o.cat !== "libre") : undefined;
  const next = isToday ? occs.find((o) => o.start && toMin(o.start) > n && (o.check ? !o.done : true)) : undefined;
  const deadlines = useMemo(() => expand(plan, t, addDays(t, 21)).filter((o) => o.deadline), [plan, t]);
  const top3 = useMemo(() => essentials(plan, date, t), [plan, date, t]);
  const coach = useMemo(() => (isToday ? coachLine(plan, t) : []), [plan, t, isToday]);
  // séances d'aujourd'hui déjà dépassées et non faites → proposer de recaler la journée
  const behind = isToday ? tasks.filter((o) => !o.done && o.start && toMin(o.start) + o.minutes <= n && o.cat !== "lecture") : [];
  const routine = isToday ? routineNow(plan, t, n) : null;
  const startable = (o?: Occ) => o && o.check && !o.done && !focusOn && !runOn;

  const Row = ({ o }: { o: Occ }) => {
    const c = cats.get(o.cat);
    return (
      <li className={`task ${o.done ? "done" : ""} p-${o.prio}`} style={{ ["--c" as string]: c?.color }}>
        <button className={`check ${o.done ? "on" : ""}`} aria-label={o.done ? "Annuler la validation" : "Valider"} onClick={() => validate(o, "Bien joué, séance validée")}>
          {o.done ? "✓" : ""}
        </button>
        <button className="task-body" onClick={() => open({ kind: "item", key: o.key })}>
          <span className="task-title">{o.title}</span>
          <span className="task-meta"><span className="dot" style={{ background: c?.color }} />{c?.name} · {timeLabel(o)}{o.start ? ` · ${fmtDur(o.minutes)}` : ""}{o.moved ? " · déplacée" : ""}</span>
          {o.cat === "course" && !o.done && <span className="task-meta run-meta">Séance {nextRun.n} : {sessionOf(nextRun.n).label}{plan.run.watch ? ` · sur ta Garmin : « ${garminName(sessionOf(nextRun.n))} »` : ""}</span>}
        </button>
        {startable(o) && <button className="play" aria-label={`Démarrer ${o.title} en mode Focus`} onClick={() => startFocus(o)}>▶</button>}
      </li>
    );
  };

  return (
    <div className={`day m-${mTab}`}>
      <section className="day-side">
        <header className="day-hero">
          <div className="day-hero-text">
            <span className="eyebrow">{isToday ? "Aujourd'hui" : date < t ? "Jour passé" : "À venir"}</span>
            <h1 className="day-title">{fmtLong(date)}</h1>
            <div className="day-nav">
              <button className="icon-btn" aria-label="Jour précédent" onClick={() => go("jour", addDays(date, -1))}>‹</button>
              {!isToday && <button className="btn sm ghost" onClick={() => go("jour", t)}>Aujourd'hui</button>}
              <button className="icon-btn" aria-label="Jour suivant" onClick={() => go("jour", addDays(date, 1))}>›</button>
            </div>
          </div>
          <Ring value={progress} size={104} label={<><b>{Math.round(progress * 100)}%</b><small>{done.length}/{tasks.length}</small></>} />
        </header>

        <div className="seg day-switch" role="tablist" aria-label="Affichage de la journée">
          <button role="tab" aria-selected={mTab === "grid"} className={mTab === "grid" ? "on" : ""} onClick={() => setTab("grid")}>Emploi du temps</button>
          <button role="tab" aria-selected={mTab === "board"} className={mTab === "board" ? "on" : ""} onClick={() => setTab("board")}>
            Tableau de bord{routine ? " · routine" : ""}
          </button>
        </div>

        <div className="stats3">
          <div><b>{done.length}</b><span>faites</span></div>
          <div><b>{tasks.length - done.length}</b><span>restantes</span></div>
          <div><b>{fmtDur(doneMin)}</b><span>sur {fmtDur(plannedMin)}</span></div>
        </div>

        {routine?.kind === "matin" && <MorningRoutine date={routine.date} />}
        {routine?.kind === "soir" && <EveningRoutine night={routine.night} />}

        {coach.length > 0 && (
          <div className="coach">
            {coach.map((l) => <p key={l}>{l}</p>)}
          </div>
        )}

        {behind.length > 0 && (
          <button className="replan-cta" onClick={() => open({ kind: "replan", date: t })}>
            <span><b>{behind.length} séance{behind.length > 1 ? "s" : ""} dépassée{behind.length > 1 ? "s" : ""}</b> · la journée n'est pas perdue</span>
            <span className="replan-go">Replanifier la suite →</span>
          </button>
        )}

        {top3.length > 0 && (
          <section className="essentials">
            <h3 className="h3">Les 3 essentiels</h3>
            <ol>
              {top3.map((o, i) => (
                <li key={o.key} style={{ ["--c" as string]: cats.get(o.cat)?.color }}>
                  <span className="ess-n">{i + 1}</span>
                  <button className="ess-body" onClick={() => open({ kind: "item", key: o.key })}>
                    <b>{o.title}</b><span className="muted small">{timeLabel(o)} · {fmtDur(o.minutes)}</span>
                  </button>
                  {startable(o) && <button className="btn sm primary" onClick={() => startFocus(o)}>▶ Démarrer</button>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {isToday && (current || next) && (
          <div className="now-card">
            {current && (
              <button className="now-row" onClick={() => open({ kind: "item", key: current.key })} style={{ ["--c" as string]: cats.get(current.cat)?.color }}>
                <span className="now-tag live">Maintenant</span>
                <span className="now-title">{current.title}</span>
                <span className="now-time">jusqu'à {current.end}</span>
              </button>
            )}
            {startable(current) && (
              <button className="btn primary start-now" onClick={() => startFocus(current!)}>▶ Démarrer maintenant : {current!.title}</button>
            )}
            {next && (
              <button className="now-row" onClick={() => open({ kind: "item", key: next.key })} style={{ ["--c" as string]: cats.get(next.cat)?.color }}>
                <span className="now-tag">Ensuite</span>
                <span className="now-title">{next.title}</span>
                <span className="now-time">{next.start}</span>
              </button>
            )}
          </div>
        )}

        {late.length > 0 && (
          <section className="late">
            <h3 className="h3">À rattraper <span className="count">{late.length}</span></h3>
            <p className="muted small">Pas validées les jours précédents. Rien n'est compté comme fait sans toi : valide, reporte ou supprime.</p>
            <ul className="late-list">
              {late.slice(0, 6).map((o) => (
                <li key={o.key} style={{ ["--c" as string]: cats.get(o.cat)?.color }}>
                  <button className="late-title" onClick={() => open({ kind: "item", key: o.key })}>
                    <span className="dot" style={{ background: cats.get(o.cat)?.color }} />{o.title} <span className="muted">· {fmtShort(o.date)}</span>
                  </button>
                  <div className="late-actions">
                    <button className="btn xs" onClick={() => validate(o, "Validée (en retard)")}>Faite</button>
                    <button className="btn xs" onClick={() => apply((p) => postpone(p, o.key, addDays(t, 1)), "Reportée à demain")}>Demain</button>
                    <button className="btn xs ghost" onClick={() => open({ kind: "postpone", key: o.key })}>Autre date</button>
                  </div>
                </li>
              ))}
            </ul>
            {late.length > 6 && <p className="muted small">+ {late.length - 6} autres dans le bilan de la semaine.</p>}
          </section>
        )}

        <section className="list-block">
          <h3 className="h3"><span className="prio-bar fixe" />Obligations fixes</h3>
          {fixed.length === 0 ? <p className="muted small">Aucune aujourd'hui.</p> : (
            <ul className="fixed-list">
              {fixed.map((o) => (
                <li key={o.key}>
                  <button onClick={() => open({ kind: "item", key: o.key })} style={{ ["--c" as string]: cats.get(o.cat)?.color }}>
                    <span className="fx-time">{o.start ?? "jour"}</span>
                    <span className="fx-title">{o.deadline && <span className="flag">⚑</span>}{o.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="list-block">
          <h3 className="h3"><span className="prio-bar important" />Objectifs importants <span className="count">{important.filter((o) => o.done).length}/{important.length}</span></h3>
          {important.length === 0 ? <p className="muted small">Rien d'important prévu.</p> : <ul className="tasks">{important.map((o) => <Row key={o.key} o={o} />)}</ul>}
        </section>

        <section className="list-block">
          <h3 className="h3"><span className="prio-bar facultatif" />Facultatif <span className="count">{optional.filter((o) => o.done).length}/{optional.length}</span></h3>
          {optional.length === 0 ? <p className="muted small">Rien de facultatif.</p> : <ul className="tasks">{optional.map((o) => <Row key={o.key} o={o} />)}</ul>}
          <p className="muted small">Facultatif = à faire si tu as l'énergie ; ça peut sauter sans culpabiliser.</p>
        </section>

        <button className="btn add-wide" onClick={() => open({ kind: "new", defaults: { date } })}>+ Ajouter une tâche ou un événement</button>

        {deadlines.length > 0 && (
          <section className="list-block">
            <h3 className="h3">Échéances (3 semaines)</h3>
            <ul className="dl-list">
              {deadlines.slice(0, 6).map((o) => {
                const days = Math.round((new Date(`${o.date}T12:00`).getTime() - new Date(`${t}T12:00`).getTime()) / 864e5);
                return (
                  <li key={o.key}>
                    <button onClick={() => go("jour", o.date)}>
                      <span className={`dl-count ${days <= 2 ? "hot" : ""}`}>{days === 0 ? "auj." : `J-${days}`}</span>
                      <span>{o.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>

      <section className="day-grid">
        <TimeGrid dates={[date]} ppm={1.15} />
      </section>
    </div>
  );
}
