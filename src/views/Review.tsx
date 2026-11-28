/** BILAN DE LA SEMAINE : prévu vs validé, résumé, graphiques, séances à reporter, historique. */
import { useMemo, useState } from "react";
import { addDays, fmtDM, fmtDur, fmtShort, mondayOf, today, type ISODate } from "../lib/dates";
import { deleteOccurrence, findOcc, postpone } from "../lib/model";
import { computeReview, fmtGoal, type WeekReview } from "../lib/review";
import { FIRST_WEEK, useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { Bar } from "../components/common";
import { sleepStats } from "../lib/coach";
import { expand } from "../lib/model";
import { CopiesSection, GradesSection } from "./Grades";
import { nextSession } from "../lib/run";

export default function Review({ week }: { week: ISODate }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const go = useStore((s) => s.go);
  const open = useUI((s) => s.open);
  const t = today();
  const ended = addDays(week, 6) < t;
  const frozen = plan.reviews[week] as WeekReview | undefined;
  const prev = plan.reviews[addDays(week, -7)] as WeekReview | undefined;
  const live = useMemo(() => computeReview(plan, week, t, prev), [plan, week, t, prev]);
  const [showFrozen, setShowFrozen] = useState(true);
  const r = ended && frozen && showFrozen ? frozen : live;

  // séances non faites de la semaine, encore présentes (pas reportées, pas supprimées)
  const undone = live.lines.flatMap((l) => l.missed.map((m) => ({ ...m, color: l.color, cat: l.name }))).filter((m) => findOcc(plan, m.key));
  const nextWeekDate = (d: ISODate) => (addDays(d, 7) < t ? addDays(t, 1) : addDays(d, 7));

  const history = Object.entries(plan.reviews as Record<string, WeekReview>).sort(([a], [b]) => b.localeCompare(a));
  const sleep = sleepStats(plan, addDays(week, -1), addDays(week, 6));
  const focusDone = useMemo(() => expand(plan, week, addDays(week, 6)).filter((o) => o.done?.focus), [plan, week]);
  const focusMin = focusDone.reduce((a, o) => a + o.done!.minutes, 0);
  const distractions = focusDone.reduce((a, o) => a + (o.done!.distractions ?? 0), 0);
  const weekRuns = plan.run.log.filter((l) => l.date >= week && l.date <= addDays(week, 6));
  const nextRun = nextSession(plan.run, t).n;

  return (
    <div className="review">
      {ended && frozen && (
        <div className="frozen-note">
          {showFrozen ? "Bilan figé à la fin de la semaine." : "Bilan recalculé avec tes validations faites depuis."}
          <button className="btn xs ghost" onClick={() => setShowFrozen(!showFrozen)}>{showFrozen ? "Voir la version à jour" : "Voir la version figée"}</button>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><span>Heures prévues</span><b>{fmtDur(r.totals.plannedMin)}</b></div>
        <div className="kpi"><span>Heures validées</span><b className="lime">{fmtDur(r.totals.doneMin)}</b></div>
        <div className="kpi"><span>Réalisation</span><b className={r.totals.rate >= 70 ? "lime" : r.totals.rate >= 40 ? "orange" : "red"}>{r.totals.rate} %</b></div>
        <div className="kpi"><span>Tâches faites</span><b>{r.totals.tasksDone}</b></div>
        <div className="kpi"><span>Non faites</span><b>{r.totals.tasksLeft}</b></div>
        <div className="kpi"><span>Reportées</span><b>{r.totals.postponed}</b></div>
      </div>
      {!ended && <p className="muted small">Semaine en cours : encore {r.totals.tasksUpcoming} séance{r.totals.tasksUpcoming > 1 ? "s" : ""} à venir, non comptées comme ratées.</p>}

      <section className="card">
        <h3 className="h3">Ce que dit ta semaine</h3>
        <ul className="insights">{r.insights.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>

      <section className="card">
        <h3 className="h3">Objectif vs réalisé, par matière</h3>
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>Activité</th><th>Prévu</th><th>Validé</th><th className="wide">Progression</th><th>Séances</th></tr></thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.cat}>
                  <td><span className="dot" style={{ background: l.color }} />{l.name}</td>
                  <td className="num">{fmtDur(l.plannedMin)}</td>
                  <td className="num">{fmtDur(l.doneMin)}</td>
                  <td className="wide"><div className="prog"><Bar value={l.doneMin} max={l.plannedMin} color={l.color} /><span className="num">{l.pct} %</span></div></td>
                  <td className="num">{l.doneCount}/{l.plannedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GradesSection week={week} />
      <CopiesSection />

      <div className="grid2">
        <section className="card">
          <h3 className="h3">Sommeil</h3>
          {sleep.logged === 0 ? <p className="muted small">Pas encore de lever / coucher noté cette semaine. Coche « Debout » dans la routine du matin, et note l’heure d’extinction de la veille juste en dessous.</p> : (
            <div className="mini-kpis">
              <div><span>Coucher moyen</span><b>{sleep.avgBed ?? "—"}</b><small>objectif {plan.prefs.bedTarget}</small></div>
              <div><span>Lever moyen</span><b>{sleep.avgWake ?? "—"}</b><small>objectif : ta routine du jour</small></div>
              <div><span>Sommeil moyen</span><b>{sleep.avgSleep ? fmtDur(sleep.avgSleep) : "—"}</b><small>{sleep.nights} nuit{sleep.nights > 1 ? "s" : ""} complète{sleep.nights > 1 ? "s" : ""}</small></div>
              <div><span>À l'heure</span><b>{sleep.onTimeBed} / {sleep.onTimeWake}</b><small>couchers / levers</small></div>
            </div>
          )}
        </section>
        <section className="card">
          <h3 className="h3">Course à pied</h3>
          {weekRuns.length === 0 ? <p className="muted small">Aucune sortie cette semaine. Onglet Course : la prochaine séance est la {nextRun}.</p> : (
            <div className="mini-kpis">
              <div><span>Sorties</span><b>{weekRuns.length}/3</b><small>{weekRuns.filter((l) => l.completed && l.feel < 4).length} réussie{weekRuns.filter((l) => l.completed && l.feel < 4).length > 1 ? "s" : ""}</small></div>
              <div><span>Couru</span><b>{fmtDur(Math.round(weekRuns.reduce((a, l) => a + l.runSec, 0) / 60))}</b><small>prochaine : séance {nextRun}</small></div>
            </div>
          )}
        </section>
        <section className="card">
          <h3 className="h3">Mode Focus</h3>
          {focusDone.length === 0 ? <p className="muted small">Aucune séance lancée en mode Focus cette semaine. Bouton ▶ sur n'importe quelle séance.</p> : (
            <div className="mini-kpis">
              <div><span>Séances en Focus</span><b>{focusDone.length}</b><small>{fmtDur(focusMin)} au total</small></div>
              <div><span>Décrochages</span><b>{distractions}</b><small>{(distractions / focusDone.length).toFixed(1).replace(".", ",")} par séance</small></div>
            </div>
          )}
        </section>
      </div>

      {r.goals.length > 0 && (
        <section className="card">
          <h3 className="h3">Objectifs hebdo</h3>
          <ul className="goals two">
            {r.goals.map((g) => (
              <li key={g.id}>
                <div className="goal-top"><span>{g.label}</span><b className={g.value >= g.target ? "ok" : ""}>{fmtGoal(g.value, g.unit)} / {fmtGoal(g.target, g.unit)}</b></div>
                <Bar value={g.value} max={g.target} thin />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3 className="h3">Séances non effectuées <span className="count">{undone.length}</span></h3>
        {undone.length === 0 ? <p className="muted small">Rien à rattraper pour cette semaine.</p> : (
          <>
            <p className="muted small">Rien n'est reporté sans ton accord. Choisis pour chacune.</p>
            <ul className="undone">
              {undone.map((m) => (
                <li key={m.key}>
                  <button className="undone-title" onClick={() => open({ kind: "item", key: m.key })}>
                    <span className="dot" style={{ background: m.color }} />{m.title}<span className="muted"> · {fmtShort(m.date)} · {fmtDur(m.minutes)}</span>
                  </button>
                  <div className="late-actions">
                    <button className="btn xs" onClick={() => apply((p) => postpone(p, m.key, nextWeekDate(m.date)), "Reportée à la semaine suivante")}>Semaine suivante</button>
                    <button className="btn xs ghost" onClick={() => open({ kind: "postpone", key: m.key })}>Choisir une date</button>
                    <button className="btn xs danger-ghost" onClick={() => apply((p) => deleteOccurrence(p, m.key, "one"), "Supprimée")}>Supprimer</button>
                  </div>
                </li>
              ))}
            </ul>
            {undone.length > 1 && (
              <button className="btn ghost" onClick={() => apply((p) => undone.reduce((acc, m) => postpone(acc, m.key, nextWeekDate(m.date)), p), `${undone.length} séances reportées à la semaine suivante`)}>
                Tout reporter à la semaine suivante ({undone.length})
              </button>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h3 className="h3">Historique</h3>
        {history.length === 0 ? (
          <p className="muted small">Les bilans sont figés et gardés chaque lundi. Le premier arrivera le lundi {fmtDM(addDays(FIRST_WEEK, 7))}</p>
        ) : (
          <ul className="history">
            {history.map(([w, h]) => (
              <li key={w}>
                <button onClick={() => go("semaine", w)} className={w === week ? "on" : ""}>
                  <span>Sem. du {fmtDM(w)}</span>
                  <span className="hist-bar"><span style={{ width: `${Math.min(100, h.totals.rate)}%` }} /></span>
                  <b className="num">{h.totals.rate} %</b>
                  <span className="muted num">{fmtDur(h.totals.doneMin)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {week !== mondayOf(t) && <button className="btn xs ghost" onClick={() => go("semaine", t)}>Revenir à cette semaine</button>}
      </section>
    </div>
  );
}
