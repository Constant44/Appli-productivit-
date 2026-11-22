/** COURSE : apprendre à courir, de 1 minute à 30 minutes sans t'arrêter. */
import { useMemo, useState } from "react";
import { addDays, fmtDM, fmtShort, nowMin, toMin, today } from "../lib/dates";
import { expand } from "../lib/model";
import {
  FEELS, LAST, MILESTONES, PROGRAM, RULES, bestDone, blocksTotal, deleteRun, longestRun, nextSession, pickSession, runStats, runTotal, sessionOf, tipOf,
} from "../lib/run";
import { useRun } from "../lib/runSession";
import { useStore } from "../lib/store";
import { Ring } from "../components/common";

const human = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
};

export default function RunView() {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const go = useStore((s) => s.go);
  const start = useRun((r) => r.start);
  const active = useRun((r) => !!r.active);
  const t = today();
  const next = nextSession(plan.run, t);
  const s = sessionOf(next.n);
  const st = useMemo(() => runStats(plan.run, t), [plan.run, t]);
  const best = bestDone(plan.run.log);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // prochaine sortie prévue dans le planning
  const upcoming = useMemo(() => {
    const n = nowMin();
    return expand(plan, t, addDays(t, 10)).find((o) => o.cat === "course" && !o.done && (o.date > t || !o.end || toMin(o.end) > n));
  }, [plan, t]);
  const todayOcc = upcoming && upcoming.date === t ? upcoming : undefined;
  const maxWeek = Math.max(1, ...st.weeks.map((w) => w.runSec));
  const log = [...plan.run.log].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="runv">
      <header className="runv-hero card">
        <div className="runv-main">
          <span className="eyebrow">Apprendre à courir · de 1 à 30 minutes</span>
          <h1 className="runv-title">Séance {s.n}<small> / {LAST}</small></h1>
          <p className="runv-label">{s.label}</p>
          <p className="muted small">5 min de marche rapide, la séance, 5 min de marche au calme · {human(blocksTotal(s))} en tout, dont {human(runTotal(s))} de course.</p>
          {next.reason && <p className="runv-reason">{next.reason}</p>}
          <div className="runv-blocks" aria-label="Déroulé de la séance">
            {s.blocks.map((b, i) => <span key={i} className={`rb k-${b.kind}`} style={{ flexGrow: b.sec }} title={`${b.kind === "run" ? "Course" : b.kind === "walk" ? "Marche" : b.kind === "warm" ? "Échauffement" : "Retour au calme"} ${human(b.sec)}`} />)}
          </div>
          <div className="runv-cta">
            <button className="btn primary lg" disabled={active} onClick={() => start(todayOcc, s.n)}>▶ Lancer la séance {s.n}</button>
            {upcoming && (
              <button className="btn ghost" onClick={() => go("jour", upcoming.date)}>
                Prévue {upcoming.date === t ? "aujourd'hui" : fmtShort(upcoming.date)} à {upcoming.start}
              </button>
            )}
          </div>
          <div className="runv-pick">
            <span className="muted small">Choisir une autre séance :</span>
            <button className="btn xs ghost" disabled={s.n <= 1} onClick={() => apply((p) => pickSession(p, s.n - 1), `Prochaine sortie : séance ${s.n - 1}`)}>← Précédente</button>
            <button className="btn xs ghost" disabled={s.n >= LAST} onClick={() => apply((p) => pickSession(p, s.n + 1), `Prochaine sortie : séance ${s.n + 1}`)}>Suivante →</button>
            {plan.run.pick && <button className="btn xs ghost" onClick={() => apply((p) => pickSession(p, undefined))}>Revenir au programme</button>}
          </div>
        </div>
        <Ring value={best / LAST} size={128} label={<><b>{Math.round((best / LAST) * 100)}%</b><small>du programme</small></>} />
      </header>

      <section className="card">
        <h3 className="h3">Le parcours</h3>
        <div className="runv-path">
          {Array.from({ length: 11 }, (_, w) => (
            <div key={w} className="rp-week">
              <span className="rp-w muted small">S{w + 1}</span>
              <div className="rp-dots">
                {PROGRAM.filter((p) => p.week === w + 1).map((p) => {
                  const ok = plan.run.log.some((l) => l.session === p.n && l.completed && l.feel < 4);
                  return <span key={p.n} className={`rp-dot ${ok ? "ok" : ""} ${p.n === s.n ? "cur" : ""}`} title={`Séance ${p.n} : ${p.label}`} />;
                })}
              </div>
              <span className="rp-l small">{human(longestRun(PROGRAM[w * 3]))}</span>
            </div>
          ))}
        </div>
        <ul className="runv-miles">
          {MILESTONES.map((m) => <li key={m.n} className={best >= m.n ? "ok" : ""}><span className="rm-dot" />{m.label}<span className="muted small"> · séance {m.n}</span></li>)}
        </ul>
      </section>

      <div className="kpis">
        <div className="kpi"><span>Sorties</span><b>{st.sessions}</b></div>
        <div className="kpi"><span>Temps couru</span><b className="lime">{human(st.runSec)}</b></div>
        <div className="kpi"><span>Plus longue d'affilée</span><b>{st.longest ? human(st.longest) : "—"}</b></div>
        <div className="kpi"><span>Cette semaine</span><b className={st.thisWeek >= 3 ? "lime" : st.thisWeek ? "orange" : ""}>{st.thisWeek}/3</b></div>
      </div>

      <div className="grid2">
        <section className="card">
          <h3 className="h3">Minutes courues, par semaine</h3>
          <div className="runv-chart">
            {st.weeks.map((w) => (
              <div key={w.from} className="rc-col" title={`Semaine du ${fmtDM(w.from)} : ${human(w.runSec)}, ${w.count} sortie${w.count > 1 ? "s" : ""}`}>
                <span className="rc-val num">{w.runSec ? Math.round(w.runSec / 60) : ""}</span>
                <span className="rc-bar" style={{ height: `${(w.runSec / maxWeek) * 100}%` }} />
                <span className="rc-lab muted">{fmtDM(w.from).replace(/\s.*/, "")}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3 className="h3">Le conseil de la semaine</h3>
          <p className="runv-tip">{tipOf(s.n)}</p>
          <h3 className="h3">Les règles</h3>
          <ul className="runv-rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      </div>

      <section className="card">
        <h3 className="h3">Journal <span className="count">{log.length}</span></h3>
        {log.length === 0 ? <p className="muted small">Ta première sortie arrivera ici. Séance 1 : 8 fois 1 minute de course. Tu peux le faire.</p> : (
          <ul className="runv-log">
            {log.map((l) => (
              <li key={l.id}>
                <span className="num">{fmtShort(l.date)}</span>
                <span>Séance {l.session}<span className="muted small"> · {sessionOf(l.session).label}</span></span>
                <span className="num">{human(l.runSec)}</span>
                <span className={`feel-tag f${l.feel}`}>{l.completed ? FEELS[l.feel] : "Pas finie"}</span>
                {confirmDel === l.id
                  ? <span className="row gap"><button className="btn xs danger" onClick={() => { apply((p) => deleteRun(p, l.id), "Sortie supprimée"); setConfirmDel(null); }}>Supprimer</button><button className="btn xs ghost" onClick={() => setConfirmDel(null)}>Non</button></span>
                  : <button className="icon-btn sm" aria-label="Supprimer cette sortie" onClick={() => setConfirmDel(l.id)}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
