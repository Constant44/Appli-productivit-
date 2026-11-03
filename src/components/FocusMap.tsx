/** Où, quand et sur quoi tu te concentres le mieux (concentration notée sur 10 en fin de session). */
import { useMemo } from "react";
import { useStore } from "../lib/store";
import { focusInsights, MIN_SESSIONS, type FocusRow } from "../lib/focusInsights";
import { fmtMin } from "../lib/utils";

const fmt = (x: number) => x.toFixed(1).replace(".", ",");

function Rows({ title, rows }: { title: string; rows: FocusRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="fm-col">
      <h4>{title}</h4>
      {rows.slice(0, 6).map((r) => (
        <div key={r.key} className={`fm-row ${r.n < MIN_SESSIONS ? "few" : ""}`}>
          <span className="fm-k">{r.key}</span>
          <div className="bar"><div style={{ width: `${r.avg * 10}%`, background: `hsl(${(r.avg - 1) * 12} 70% 50%)` }} /></div>
          <b>{fmt(r.avg)}</b>
          <span className="small muted">{r.n} · {fmtMin(r.minutes)}</span>
        </div>
      ))}
    </div>
  );
}

export function FocusMap() {
  const sessions = useStore((s) => s.sessions);
  const f = useMemo(() => focusInsights(sessions), [sessions]);
  return (
    <section className="card focus-map" style={{ marginBottom: 16 }}>
      <h3>🎯 Où et quand tu te concentres le mieux</h3>
      {f.rated < MIN_SESSIONS ? (
        <p className="small muted" style={{ margin: 0 }}>
          Note ta concentration sur 10 et ton lieu à la fin de chaque session : dès {MIN_SESSIONS} sessions notées ({f.rated} pour l'instant), tu verras ici tes meilleurs lieux, moments et matières.
        </p>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            Moyenne : <b>{fmt(f.overall)}/10</b> sur {f.rated} sessions.
            {f.best && <> Ton meilleur créneau : <b>{f.best.key}</b> ({fmt(f.best.avg)}/10).</>}
            {f.worstSubject && f.worstSubject.avg < f.overall - 0.5 && <> Tu décroches le plus en <b>{f.worstSubject.key}</b> ({fmt(f.worstSubject.avg)}) : garde-la pour ton meilleur créneau.</>}
          </p>
          <div className="fm-grid">
            <Rows title="Lieu" rows={f.byPlace} />
            <Rows title="Moment" rows={f.bySlot} />
            <Rows title="Matière" rows={f.bySubject} />
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>En grisé : moins de {MIN_SESSIONS} sessions, pas encore fiable.</p>
        </>
      )}
    </section>
  );
}
