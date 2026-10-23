import { useState } from "react";
import { useStore } from "../lib/store";
import { addDays, fmtDay, fmtTime, isoDay, startOfWeek, subjectColor } from "../lib/utils";
import { Field, Modal } from "../components/ui";

const H0 = 7;
const H1 = 22;
const HPX = 48;
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type Block = { id: string; start: Date; end: Date; title: string; sub?: string; color: string; canceled?: boolean; tag?: string };

/** Répartit les blocs qui se chevauchent sur plusieurs colonnes. */
function layout(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => +a.start - +b.start || +b.end - +a.end);
  const out: Array<{ b: Block; lane: number; lanes: number }> = [];
  let cluster: Array<{ b: Block; lane: number; lanes: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const x of cluster) x.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (+b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= +b.start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(+b.end); } else laneEnds[lane] = +b.end;
    cluster.push({ b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, +b.end);
  }
  flush();
  return out;
}

export default function Timetable() {
  const { lessons, evals, customEvents, sessions, deleteCustomEvent } = useStore();
  const [offset, setOffset] = useState(0);
  const [showSessions, setShowSessions] = useState(true);
  const [adding, setAdding] = useState(false);
  const monday = addDays(startOfWeek(new Date()), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todayIso = isoDay(new Date());

  const blocksFor = (day: Date): Block[] => {
    const iso = isoDay(day);
    const out: Block[] = [];
    for (const l of lessons)
      if (isoDay(l.start) === iso)
        out.push({
          id: l.id, start: new Date(l.start), end: new Date(l.end), title: l.subject,
          sub: [l.title, l.room, l.teacher].filter(Boolean).join(" · "), color: l.color ?? subjectColor(l.subject),
          canceled: l.canceled, tag: l.isTest ? "ÉVAL" : l.status,
        });
    for (const e of evals)
      if (isoDay(e.date) === iso && e.source === "manual") {
        const st = new Date(e.date);
        out.push({ id: e.id, start: st, end: new Date(+st + (e.durationMin ?? 60) * 60000), title: `${e.type} ${e.subject}`, sub: [e.room, e.examiner].filter(Boolean).join(" · "), color: e.type === "Khôlle" ? "#a78bfa" : "#f87171", tag: e.type.toUpperCase() });
      }
    const wd = (day.getDay() + 6) % 7;
    for (const c of customEvents)
      if (c.weekday === wd) {
        const [h1, m1] = c.startTime.split(":").map(Number);
        const [h2, m2] = c.endTime.split(":").map(Number);
        const s = new Date(day); s.setHours(h1, m1, 0, 0);
        const e = new Date(day); e.setHours(h2, m2, 0, 0);
        out.push({ id: c.id, start: s, end: e, title: c.title, color: c.color, tag: "perso" });
      }
    if (showSessions)
      for (const s of sessions)
        if (isoDay(s.start) === iso) {
          const st = new Date(s.start);
          out.push({ id: s.id, start: st, end: new Date(+st + s.minutes * 60000), title: `⏱️ ${s.subject ?? "Travail"}`, sub: `${s.minutes} min`, color: "#22c55e" });
        }
    return out;
  };

  const top = (d: Date) => (d.getHours() + d.getMinutes() / 60 - H0) * HPX;
  const now = new Date();

  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title">Emploi du temps</h1>
          <p className="page-sub">Cours Pronote, DS/khôlles, créneaux perso récurrents et tes sessions de travail (en vert).</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setOffset(offset - 1)}>←</button>
          <button className="btn" onClick={() => setOffset(0)}>Cette semaine</button>
          <button className="btn" onClick={() => setOffset(offset + 1)}>→</button>
          <label className="row small"><input type="checkbox" checked={showSessions} onChange={(e) => setShowSessions(e.target.checked)} /> sessions</label>
          <button className="btn primary" onClick={() => setAdding(true)}>+ Créneau perso</button>
        </div>
      </div>
      <p className="muted small">Semaine du {fmtDay(monday)} au {fmtDay(addDays(monday, 6))}</p>
      <div className="tt-wrap">
        <div className="tt" style={{ minWidth: 820 }}>
          <div className="tt-head" />
          {days.map((d, i) => <div key={i} className={`tt-head ${isoDay(d) === todayIso ? "today" : ""}`}>{DAYS[i]} {d.getDate()}</div>)}
          <div>
            {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} className="tt-hour">{H0 + i}h</div>)}
          </div>
          {days.map((d, i) => (
            <div key={i} className="tt-col" style={{ height: (H1 - H0) * HPX }}>
              {Array.from({ length: H1 - H0 }, (_, k) => <div key={k} className="tt-hour" />)}
              {isoDay(d) === todayIso && now.getHours() >= H0 && now.getHours() < H1 && <div className="tt-now" style={{ top: top(now) }} />}
              {layout(blocksFor(d)).map(({ b, lane, lanes }) => (
                <div key={b.id} className={`tt-ev ${b.canceled ? "canceled" : ""}`}
                  title={`${b.title} ${fmtTime(b.start)}–${fmtTime(b.end)} ${b.sub ?? ""}`}
                  style={{
                    top: top(b.start), height: Math.max(18, top(b.end) - top(b.start) - 2), background: b.color + "33", borderLeftColor: b.color,
                    left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, right: "auto",
                  }}>
                  <b>{b.title}</b>
                  {fmtTime(b.start)}–{fmtTime(b.end)}
                  {b.tag && <> · <span style={{ color: "var(--gold)" }}>{b.tag}</span></>}
                  {b.sub && <div className="muted">{b.sub}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {customEvents.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Créneaux perso récurrents</h3>
          <div className="row">
            {customEvents.map((c) => (
              <span key={c.id} className="pill" style={{ borderColor: c.color }}>
                {DAYS[c.weekday]} {c.startTime}–{c.endTime} · {c.title}
                <button className="btn sm ghost" onClick={() => deleteCustomEvent(c.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
      {lessons.length === 0 && <p className="muted small">Astuce : connecte Pronote dans « Pronote & réglages » pour importer automatiquement ton emploi du temps.</p>}
      {adding && <AddCustom onClose={() => setAdding(false)} />}
    </>
  );
}

function AddCustom({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addCustomEvent);
  const [e, setE] = useState({ title: "", weekday: 0, startTime: "18:00", endTime: "19:00", color: "#38bdf8" });
  return (
    <Modal title="Créneau récurrent" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!e.title} onClick={() => { add(e); onClose(); }}>Ajouter</button></>}>
      <div className="form-grid">
        <Field label="Titre"><input className="input" autoFocus value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} placeholder="Sport, khôlle d'anglais, TIPE…" /></Field>
        <Field label="Jour">
          <select className="input" value={e.weekday} onChange={(x) => setE({ ...e, weekday: Number(x.target.value) })}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Début"><input className="input" type="time" value={e.startTime} onChange={(x) => setE({ ...e, startTime: x.target.value })} /></Field>
        <Field label="Fin"><input className="input" type="time" value={e.endTime} onChange={(x) => setE({ ...e, endTime: x.target.value })} /></Field>
        <Field label="Couleur"><input className="input" type="color" value={e.color} onChange={(x) => setE({ ...e, color: x.target.value })} style={{ height: 38 }} /></Field>
      </div>
    </Modal>
  );
}
