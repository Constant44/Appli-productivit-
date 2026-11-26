/**
 * Grille horaire (1 colonne = Journée, 7 colonnes = Semaine).
 * Glisser-déposer : souris / trackpad sur toute la carte, au doigt par la poignée ⠿ (le reste de la carte laisse défiler).
 * Un déplacement ne concerne que cette occurrence (annulable).
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { DAY_SHORT, fromMin, nowMin, parse, toMin, today, weekday, type ISODate } from "../lib/dates";
import { expand, moveOccurrence, type Occ } from "../lib/model";
import { useValidate } from "./RunLogSheet";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { useCats } from "./common";

const START_H = 7;
const END_H = 24;

type Laid = Occ & { top: number; height: number; lane: number; lanes: number };

function layout(occs: Occ[], ppm: number): Laid[] {
  const timed = occs.filter((o) => o.start).map((o) => {
    const s = Math.max(toMin(o.start!), START_H * 60);
    const e = Math.min(Math.max(s + 10, toMin(o.start!) + o.minutes), END_H * 60);
    return { o, s, e };
  }).sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Laid[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanesEnd: number[] = [];
    const assigned = cluster.map((x) => {
      let lane = lanesEnd.findIndex((end) => end <= x.s);
      if (lane < 0) { lane = lanesEnd.length; lanesEnd.push(x.e); } else lanesEnd[lane] = x.e;
      return { x, lane };
    });
    for (const { x, lane } of assigned) {
      out.push({ ...x.o, top: (x.s - START_H * 60) * ppm, height: Math.max(18, (x.e - x.s) * ppm - 2), lane, lanes: lanesEnd.length });
    }
    cluster = [];
  };
  for (const t of timed) {
    if (cluster.length && t.s >= clusterEnd) flush();
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, t.e);
  }
  if (cluster.length) flush();
  return out;
}

export default function TimeGrid({ dates, ppm = 1, compact = false }: { dates: ISODate[]; ppm?: number; compact?: boolean }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const validate = useValidate();
  const lastPointer = useRef<string>("mouse");
  const go = useStore((s) => s.go);
  const open = useUI((s) => s.open);
  const cats = useCats();
  const occs = useMemo(() => expand(plan, dates[0], dates[dates.length - 1]), [plan, dates]);
  const byDay = useMemo(() => dates.map((d) => occs.filter((o) => o.date === d)), [occs, dates]);
  const cols = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ key: string; dx: number; dy: number } | null>(null);
  const dragRef = useRef<{ key: string; x: number; y: number; moved: boolean; id: number } | null>(null);
  const [now, setNow] = useState(nowMin());
  const t = today();

  useEffect(() => {
    const i = setInterval(() => setNow(nowMin()), 60000);
    return () => clearInterval(i);
  }, []);
  // ouvre la grille sur l'heure actuelle (ou 8 h)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = dates.includes(t) ? Math.max(START_H * 60, nowMin() - 90) : 8 * 60;
    el.scrollTop = (target - START_H * 60) * ppm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates[0], ppm]);

  const height = (END_H - START_H) * 60 * ppm;

  const onDown = (e: RPE, key: string, handle: boolean) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType === "touch" && !handle) return; // au doigt : glisser seulement par la poignée (un simple appui ouvre la fiche)
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { key, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: RPE) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setDrag({ key: d.key, dx, dy });
  };
  const onUp = (e: RPE, occ: Occ) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      setDrag(null);
      open({ kind: "item", key: occ.key });
      return;
    }
    lastPointer.current = "drag"; // pas d'ouverture de fiche juste après un glisser
    const rect = cols.current!.getBoundingClientRect();
    const colW = rect.width / dates.length;
    const col = Math.max(0, Math.min(dates.length - 1, Math.floor((e.clientX - rect.left) / colW)));
    const startMin = toMin(occ.start!) + Math.round((e.clientY - d.y) / ppm / 5) * 5;
    const clamped = Math.max(START_H * 60, Math.min(END_H * 60 - 15, startMin));
    setDrag(null);
    const date = dates[col];
    const start = fromMin(clamped);
    if (date === occ.date && start === occ.start) return;
    apply((p) => moveOccurrence(p, occ.key, date, start), `Déplacé : ${DAY_SHORT[weekday(date)]} ${start}${occ.series ? " (cette occurrence)" : ""}`);
  };

  const untimed = byDay.map((l) => l.filter((o) => !o.start));
  const hasUntimed = untimed.some((l) => l.length);

  return (
    <div className={`tg ${compact ? "compact" : ""}`}>
      {dates.length > 1 && (
        <div className="tg-head" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 1fr)` }}>
          <span />
          {dates.map((d) => (
            <button key={d} className={`tg-day ${d === t ? "today" : ""}`} onClick={() => go("jour", d)}>
              <span>{DAY_SHORT[weekday(d)]}</span><b>{parse(d).getDate()}</b>
            </button>
          ))}
        </div>
      )}
      {hasUntimed && (
        <div className="tg-untimed" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 1fr)` }}>
          <span className="tg-ulabel">jour</span>
          {untimed.map((l, i) => (
            <div key={dates[i]} className="tg-ucol">
              {l.map((o) => {
                const c = cats.get(o.cat);
                return (
                  <button key={o.key} className={`tg-chip ${o.done ? "done" : ""} ${o.deadline ? "deadline" : ""}`} style={{ ["--c" as string]: c?.color }} onClick={() => open({ kind: "item", key: o.key })}>
                    {o.deadline && "⚑ "}{o.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ height, gridTemplateColumns: `48px 1fr` }}>
          <div className="tg-hours">
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <span key={i} style={{ top: i * 60 * ppm }}>{String(START_H + i).padStart(2, "0")}:00</span>
            ))}
          </div>
          <div className="tg-cols" ref={cols} style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
            {Array.from({ length: END_H - START_H }, (_, i) => <div key={i} className="tg-line" style={{ top: i * 60 * ppm }} />)}
            {dates.map((d, ci) => (
              <div key={d} className={`tg-col ${d === t ? "today" : ""}`}>
                {layout(byDay[ci], ppm).map((o) => {
                  const c = cats.get(o.cat);
                  const dragging = drag?.key === o.key;
                  const small = o.height < 34;
                  return (
                    <div
                      key={o.key}
                      className={`blk cat-${o.check ? "task" : "event"} ${o.done ? "done" : ""} ${o.prio === "facultatif" ? "opt" : ""} ${o.deadline ? "deadline" : ""} ${dragging ? "dragging" : ""} ${small ? "small" : ""}`}
                      style={{
                        ["--c" as string]: c?.color ?? "#888",
                        top: o.top, height: o.height,
                        left: `calc(${(o.lane / o.lanes) * 100}% + 2px)`, width: `calc(${100 / o.lanes}% - 4px)`,
                        transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
                      }}
                      onPointerDown={(e) => onDown(e, o.key, false)}
                      onPointerMove={onMove}
                      onPointerUp={(e) => onUp(e, o)}
                      onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && open({ kind: "item", key: o.key })}
                      onClick={() => { if (lastPointer.current !== "mouse" && lastPointer.current !== "drag" && !dragRef.current) open({ kind: "item", key: o.key }); }}
                      aria-label={`${o.title}, ${o.start}`}
                    >
                      {o.check && (
                        <button
                          className={`blk-check ${o.done ? "on" : ""}`}
                          aria-label={o.done ? "Annuler la validation" : "Valider"}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); validate(o); }}
                        >{o.done ? "✓" : ""}</button>
                      )}
                      <div className="blk-text">
                        <span className="blk-title">{o.deadline && "⚑ "}{o.title}</span>
                        {!small && !compact && <span className="blk-time">{o.start}–{o.end}</span>}
                      </div>
                      <span
                        className="blk-grip" aria-hidden
                        onPointerDown={(e) => onDown(e, o.key, true)}
                        onPointerMove={onMove}
                        onPointerUp={(e) => onUp(e, o)}
                      >⠿</span>
                    </div>
                  );
                })}
                {d === t && now >= START_H * 60 && <div className="now-line" style={{ top: (now - START_H * 60) * ppm }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
