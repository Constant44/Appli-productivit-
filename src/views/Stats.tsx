import { WeekReview } from "../components/WeekReview";
import { useMemo } from "react";
import { useStore } from "../lib/store";
import { calibrationData, minutesByDay } from "../lib/insights";
import { addDays, fmtMin, isoDay, startOfWeek, subjectColor } from "../lib/utils";

export default function Stats() {
  const { sessions, tasks } = useStore();
  const byDay = useMemo(() => minutesByDay(sessions), [sessions]);
  const cal = useMemo(() => calibrationData(tasks, sessions), [tasks, sessions]);
  const total = sessions.reduce((a, b) => a + b.minutes, 0);

  const since30 = addDays(new Date(), -30).toISOString();
  const bySubject = new Map<string, number>();
  for (const s of sessions) if (s.start >= since30) bySubject.set(s.subject ?? "Autre", (bySubject.get(s.subject ?? "Autre") ?? 0) + s.minutes);
  const subj = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const maxSubj = Math.max(1, ...subj.map((x) => x[1]));

  // Heatmap 20 semaines
  const weeks = 20;
  const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(start, i);
    return { d, m: byDay.get(isoDay(d)) ?? 0, future: d > new Date() };
  });
  const heat = (m: number) => (m === 0 ? "var(--bg2)" : m < 30 ? "#14532d" : m < 90 ? "#15803d" : m < 180 ? "#22c55e" : "#86efac");

  // 8 dernières semaines
  const weekTotals = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(startOfWeek(new Date()), -7 * (7 - i));
    let m = 0;
    for (let k = 0; k < 7; k++) m += byDay.get(isoDay(addDays(ws, k))) ?? 0;
    return { ws, m };
  });
  const maxW = Math.max(60, ...weekTotals.map((w) => w.m));
  const g = cal.global;

  return (
    <>
      <h1 className="page-title">Statistiques</h1>
      <p className="page-sub">Ton volume de travail et surtout : est-ce que tu estimes bien le temps que prennent les choses ?</p>
      <WeekReview />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat"><span className="v">{fmtMin(total)}</span><span className="l">Travail total</span></div>
        <div className="card stat"><span className="v">{fmtMin(weekTotals[7].m)}</span><span className="l">Cette semaine</span></div>
        <div className="card stat">
          <span className="v" style={{ color: g.samples ? (Math.abs(g.factor - 1) < 0.1 ? "var(--accent)" : "var(--gold)") : undefined }}>{g.samples ? `×${g.factor.toFixed(2)}` : "—"}</span>
          <span className="l">Facteur réel / estimé ({g.samples} tâches)</span>
        </div>
        <div className="card stat"><span className="v">{g.samples ? `${Math.round(g.accuracy * 100)} %` : "—"}</span><span className="l">Estimations à ±20 %</span></div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>🎯 Estimation vs réalité</h3>
          {g.samples === 0 ? (
            <div className="empty">Termine des tâches en indiquant le temps réel pour voir apparaître ta calibration.</div>
          ) : (
            <>
              <p className="small" style={{ marginTop: 0 }}>
                {g.factor > 1.08
                  ? <>En moyenne tu <b style={{ color: "var(--gold)" }}>sous-estimes</b> : une tâche prévue 1 h te prend en réalité ~{fmtMin(60 * g.factor)}.</>
                  : g.factor < 0.92
                    ? <>En moyenne tu <b style={{ color: "var(--blue)" }}>surestimes</b> : une tâche prévue 1 h te prend ~{fmtMin(60 * g.factor)}.</>
                    : <>Tes estimations sont <b style={{ color: "var(--accent)" }}>bien calibrées</b> 👌</>}
                <br /><span className="muted">Facteur = moyenne géométrique des ratios réel/estimé. L'appli l'utilise pour corriger tes plannings.</span>
              </p>
              <Scatter points={cal.points.map((p) => ({ x: p.est, y: p.act, c: subjectColor(p.task.subject), t: p.task.title }))} />
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>Matière</th><th className="num">Tâches</th><th className="num">Facteur</th><th className="num">Précision ±20 %</th></tr></thead>
                  <tbody>
                    {[...cal.subjects.entries()].sort((a, b) => b[1].samples - a[1].samples).map(([s, c]) => (
                      <tr key={s}>
                        <td><span className="dot" style={{ background: subjectColor(s) }} /> {s}</td>
                        <td className="num">{c.samples}</td>
                        <td className="num" style={{ color: c.factor > 1.15 ? "var(--red)" : c.factor < 0.87 ? "var(--blue)" : "var(--accent)" }}>×{c.factor.toFixed(2)}</td>
                        <td className="num">{Math.round(c.accuracy * 100)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>📆 Régularité (20 semaines)</h3>
            <div className="heat">
              {cells.map((c, i) => <div key={i} title={`${isoDay(c.d)} : ${fmtMin(c.m)}`} style={{ background: c.future ? "transparent" : heat(c.m) }} />)}
            </div>
          </div>
          <div className="card">
            <h3>📊 Par semaine</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
              {weekTotals.map((w, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <span className="small muted">{w.m ? fmtMin(w.m) : ""}</span>
                  <div style={{ width: "100%", height: `${(w.m / maxW) * 100}%`, minHeight: 2, background: i === 7 ? "var(--accent)" : "#22c55e66", borderRadius: 6 }} />
                  <span className="small muted">{w.ws.getDate()}/{w.ws.getMonth() + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>📚 Temps par matière (30 j)</h3>
            {subj.length === 0 && <div className="empty">Pas encore de sessions.</div>}
            <div className="stack" style={{ gap: 8 }}>
              {subj.map(([s, m]) => (
                <div key={s} className="hbar">
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                  <div className="track"><div className="fill" style={{ width: `${(m / maxSubj) * 100}%`, background: subjectColor(s) }} /></div>
                  <b style={{ textAlign: "right" }}>{fmtMin(m)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Scatter({ points }: { points: Array<{ x: number; y: number; c: string; t: string }> }) {
  const W = 420, H = 260, P = 34;
  const max = Math.max(60, ...points.flatMap((p) => [p.x, p.y])) * 1.1;
  const sx = (v: number) => P + (v / max) * (W - P - 10);
  const sy = (v: number) => H - P - (v / max) * (H - P - 10);
  const ticks = [0, max / 4, max / 2, (3 * max) / 4].map((t) => Math.round(t / 15) * 15);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P} x2={W - 10} y1={sy(t)} y2={sy(t)} stroke="#ffffff10" />
          <text x={P - 4} y={sy(t) + 4} fontSize="10" textAnchor="end" fill="#8b9bb8">{t}</text>
          <text x={sx(t)} y={H - P + 14} fontSize="10" textAnchor="middle" fill="#8b9bb8">{t}</text>
        </g>
      ))}
      <polygon points={`${sx(0)},${sy(0)} ${sx(max)},${sy(max * 1.2)} ${sx(max)},${sy(max * 0.8)}`} fill="#22c55e14" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="#22c55e" strokeDasharray="4 4" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="5" fill={p.c} stroke="#0b1220" strokeWidth="1.5"><title>{`${p.t} : estimé ${p.x} min, réel ${p.y} min`}</title></circle>
      ))}
      <text x={W / 2} y={H - 4} fontSize="11" textAnchor="middle" fill="#8b9bb8">estimé (min)</text>
      <text x={10} y={H / 2} fontSize="11" textAnchor="middle" fill="#8b9bb8" transform={`rotate(-90 10 ${H / 2})`}>réel (min)</text>
    </svg>
  );
}
