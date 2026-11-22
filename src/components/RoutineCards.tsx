/** Routines du matin et du soir, dans la Journée. Tu suis les étapes dans l'ordre, tu coches au fur et à mesure. */
import { useMemo, useState } from "react";
import { addDays, fromMin, nowMin, toMin, type ISODate } from "../lib/dates";
import { expand } from "../lib/model";
import {
  DEFAULT_ROUTINES, eveningExpected, isDone, lightsOut, nightPending, progressOf, reportBed, reportLecture, screensIndex, stepClock, stepsOf, toggleStep, wakeAt,
  type RoutineKind, type RoutineStep,
} from "../lib/routine";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";

const late = (anchor: string, at: number, n: number) => {
  // minutes de retard sur l'heure prévue (les heures après minuit comptent pour la soirée)
  const due = toMin(anchor) + at;
  const now = n < 5 * 60 && due > 12 * 60 ? n + 1440 : n;
  return now - due;
};

function Steps({ date, kind, steps, anchor, upTo, offline, focus }: { date: ISODate; kind: RoutineKind; steps: RoutineStep[]; anchor: string; upTo?: number; offline?: boolean; focus?: number }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const [open, setOpen] = useState<string | null>(null);
  const firstTodo = focus ?? steps.findIndex((s, i) => (upTo === undefined || i <= upTo) && !isDone(plan, date, kind, s.id));
  return (
    <ol className={`rt-steps ${offline ? "offline" : ""}`}>
      {steps.map((s, i) => {
        const done = isDone(plan, date, kind, s.id);
        const locked = offline || (upTo !== undefined && i > upTo);
        return (
          <li key={s.id} className={`${done ? "done" : ""} ${i === firstTodo && !locked ? "next" : ""} ${locked ? "locked" : ""}`}>
            {locked ? <span className="rt-dot" aria-hidden /> : (
              <button className={`check ${done ? "on" : ""}`} aria-label={done ? `Décocher ${s.label}` : `Fait : ${s.label}`} onClick={() => apply((p) => toggleStep(p, date, kind, s.id))}>
                {done ? "✓" : ""}
              </button>
            )}
            <span className="rt-time num">{stepClock(anchor, s.at)}</span>
            <button className="rt-label" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
              <span>{s.label}</span>
              {s.detail && (open === s.id || i === firstTodo) && <small className="muted">{s.detail}</small>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Le soir : de « Fermer la journée » jusqu'à « Écrans coupés ». La suite se fait sans écran. */
export function EveningRoutine({ night }: { night: ISODate }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const steps = stepsOf(plan, "soir");
  const L = lightsOut(plan, night);
  const si = screensIndex(steps);
  const n = nowMin();
  const over = late(L, 0, n);
  const screensDone = si >= 0 && isDone(plan, night, "soir", steps[si].id);
  const tomorrow = useMemo(() => expand(plan, addDays(night, 1), addDays(night, 1)).find((o) => o.start && o.cat !== "vie"), [plan, night]);
  const dayTasks = useMemo(() => expand(plan, night, night).filter((o) => o.check && o.cat !== "lecture"), [plan, night]);
  const tasksDone = dayTasks.filter((o) => o.done).length;
  const tasksTotal = dayTasks.length;
  const wake = wakeAt(plan, addDays(night, 1));
  const p = progressOf(plan, night, "soir");

  return (
    <section className="routine night" aria-label="Routine du soir">
      <header className="rt-head">
        <div>
          <span className="eyebrow">Routine du soir</span>
          <b className="rt-title">Lumière éteinte à {L}</b>
          <span className="muted small">Réveil demain {wake} : {fmtSleep(L, wake)} de sommeil si tu tiens l'heure.</span>
        </div>
        <span className="rt-count num">{p.done}/{p.total}</span>
      </header>
      {over > 0 && !screensDone && (
        <p className="rt-warn">Il est {fromMin(n % 1440)} : {over} min de retard sur l'extinction. Saute à « Écrans coupés » maintenant, le reste attendra demain.</p>
      )}
      {!screensDone ? (
        <>
          <p className="muted small rt-sub">{tasksDone}/{tasksTotal} séances validées aujourd'hui{tomorrow ? ` · demain, 1re séance : ${tomorrow.title} à ${tomorrow.start}` : ""}.</p>
          <Steps date={night} kind="soir" steps={steps} anchor={L} upTo={si >= 0 ? si : undefined} focus={over > 0 && si >= 0 ? si : undefined} />
          {si >= 0 && si < steps.length - 1 && <p className="muted small rt-foot">Après « Écrans coupés », tu ne touches plus à l'écran : demain matin, tu noteras l'heure d'extinction et ta lecture.</p>}
        </>
      ) : (
        <>
          <p className="rt-ok">Écrans coupés. Plus d'écran jusqu'à demain : la suite se fait sans Cadence.</p>
          <Steps date={night} kind="soir" steps={steps.slice(si + 1)} anchor={L} offline />
        </>
      )}
      <p className="muted small rt-rules">Pour t'endormir à {L} : café avant 14 h, sieste 20 min max et avant 16 h, sport intense fini avant 21 h.</p>
      {!screensDone && (
        <div className="rt-actions">
          <button className="btn xs ghost" onClick={() => apply((pl) => reportBed(pl, night, fromMin(nowMin() % 1440)), "Bonne nuit")}>Je me couche maintenant</button>
        </div>
      )}
    </section>
  );
}

const fmtSleep = (bed: string, wake: string) => {
  const m = (toMin(wake) - toMin(bed) + 1440) % 1440;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
};

/** Le matin : lever, lumière, douche… et, si besoin, l'heure d'extinction d'hier soir. */
export function MorningRoutine({ date }: { date: ISODate }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const open = useUI((s) => s.open);
  const steps = stepsOf(plan, "matin");
  const W = wakeAt(plan, date);
  const night = addDays(date, -1);
  const p = progressOf(plan, date, "matin");
  const woke = plan.sleep[date]?.wake;
  const pending = nightPending(plan, night);
  const L = lightsOut(plan, night);
  const [other, setOther] = useState("");
  const chips = [0, 30, 75, 135].map((d) => stepClock(L, d));
  const wokeAt = woke ? fromMin(new Date(woke).getHours() * 60 + new Date(woke).getMinutes()) : undefined;
  const wokeLate = wokeAt ? toMin(wokeAt) - toMin(W) : 0;

  return (
    <section className="routine morning" aria-label="Routine du matin">
      <header className="rt-head">
        <div>
          <span className="eyebrow">Routine du matin</span>
          <b className="rt-title">{wokeAt ? `Levé à ${wokeAt}` : `Lever prévu à ${W}`}</b>
          <span className="muted small">{wokeAt ? (wokeLate > 10 ? `${wokeLate} min après l'heure prévue (${W}). Demain, réveil loin du lit.` : "À l'heure. Continue dans l'ordre.") : "Une étape après l'autre, sans téléphone."}</span>
        </div>
        <span className="rt-count num">{p.done}/{p.total}</span>
      </header>

      {(pending.bed || pending.lecture) && (
        <div className="rt-night">
          {pending.lecture && (
            <div className="rt-q">
              <b>Hier soir, tu as lu avant de dormir ?</b>
              <div className="chips">
                <button className="chip" onClick={() => apply((pl) => reportLecture(pl, night, true), "Lecture validée")}>Oui</button>
                <button className="chip" onClick={() => apply((pl) => reportLecture(pl, night, false))}>Non</button>
              </div>
            </div>
          )}
          {pending.bed && (
            <div className="rt-q">
              <b>Lumière éteinte à…</b>
              <div className="chips">
                {chips.map((c, i) => (
                  <button key={c} className="chip" onClick={() => apply((pl) => reportBed(pl, night, c), `Extinction notée : ${c}`)}>{c}{i === 0 ? " (prévu)" : ""}</button>
                ))}
                <span className="row gap rt-other">
                  <input id="rt-bed-other" className="input sm" type="time" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Autre heure d'extinction" />
                  <button className="btn xs" disabled={!other} onClick={() => apply((pl) => reportBed(pl, night, other), `Extinction notée : ${other}`)}>OK</button>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <Steps date={date} kind="matin" steps={steps} anchor={W} />
      <div className="rt-actions">
        <button className="btn xs ghost" onClick={() => open({ kind: "settings" })}>Modifier ma routine</button>
      </div>
    </section>
  );
}

/** Quelle routine afficher maintenant ? (le soir à partir de 75 min avant l'extinction, jusqu'à 5 h) */
export function routineNow(plan: ReturnType<typeof useStore.getState>["plan"], t: ISODate, n: number): { kind: "matin"; date: ISODate } | { kind: "soir"; night: ISODate } | null {
  const night = n < 5 * 60 ? addDays(t, -1) : t;
  if (eveningExpected(plan, night) && !plan.sleep[night]?.bed) {
    const L = lightsOut(plan, night);
    if (n < 5 * 60 || n >= toMin(L) - 75) return { kind: "soir", night };
  }
  if (n >= 4 * 60 && n < 14 * 60) {
    const pr = progressOf(plan, t, "matin");
    const np = nightPending(plan, addDays(t, -1));
    if (pr.done < pr.total || np.bed || np.lecture) return { kind: "matin", date: t };
  }
  return null;
}

/** Réglages : modifier les étapes (texte, minute), en ajouter, en retirer, revenir à la routine proposée. */
export function RoutineEditor() {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const set = (kind: RoutineKind, list: RoutineStep[]) => apply((p) => ({ ...p, routines: { ...p.routines, [kind]: list } }));
  const edit = (kind: RoutineKind, id: string, patch: Partial<RoutineStep>) => set(kind, plan.routines[kind].map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const ACTION: Record<string, string> = { wake: "note l'heure de lever", screens: "après elle : sans écran", lecture: "valide la lecture du soir", bed: "note l'heure d'extinction" };
  return (
    <div className="rt-edit">
      {(["matin", "soir"] as RoutineKind[]).map((kind) => (
        <div key={kind} className="rt-edit-col">
          <b>{kind === "matin" ? "Matin · minutes après le lever" : "Soir · minutes avant l'extinction"}</b>
          {stepsOf(plan, kind).map((s) => (
            <div key={s.id} className="rt-edit-row">
              <span className="muted small">{kind === "matin" ? "+" : "−"}</span>
              <input id={`rt-at-${s.id}`} className="input xs num" type="number" min={0} max={180} value={Math.abs(s.at)} aria-label="Minutes"
                onChange={(e) => edit(kind, s.id, { at: (kind === "matin" ? 1 : -1) * Math.max(0, Math.min(180, Number(e.target.value) || 0)) })} />
              <input id={`rt-l-${s.id}`} className="input" value={s.label} onChange={(e) => edit(kind, s.id, { label: e.target.value })} />
              {s.action ? <span className="rt-tag" title={ACTION[s.action]}>{ACTION[s.action]}</span>
                : <button className="icon-btn" aria-label={`Retirer ${s.label}`} onClick={() => set(kind, plan.routines[kind].filter((x) => x.id !== s.id))}>✕</button>}
            </div>
          ))}
          <button className="btn xs ghost" onClick={() => set(kind, [...plan.routines[kind], { id: `${kind[0]}-${Math.random().toString(36).slice(2, 8)}`, label: "Nouvelle étape", at: kind === "matin" ? 20 : -20 }])}>+ Ajouter une étape</button>
        </div>
      ))}
      <button className="btn xs ghost" onClick={() => apply((p) => ({ ...p, routines: structuredClone(DEFAULT_ROUTINES) }), "Routine proposée remise")}>Revenir à la routine proposée</button>
    </div>
  );
}
