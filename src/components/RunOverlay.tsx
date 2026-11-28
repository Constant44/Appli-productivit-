/** Séance de course guidée, plein écran : lisible d'un coup d'œil en courant, l'écran reste allumé. */
import { useEffect, useRef, useState } from "react";
import { FEELS, blocksTotal, completedAt, positionAt, repOf, runSecAt, sessionOf, tipOf, type Feel, type RunBlockKind } from "../lib/run";
import { elapsedSec, useRun } from "../lib/runSession";

const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const human = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
};
const WORD: Record<RunBlockKind, string> = { warm: "Échauffement", run: "Cours", walk: "Marche", cool: "Retour au calme" };
const SUB: Record<RunBlockKind, string> = { warm: "marche rapide, bras actifs", run: "lentement : tu dois pouvoir parler", walk: "marche normale, souffle", cool: "marche tranquille, c'est fini bientôt" };

type WakeLock = { release: () => Promise<void> };

export default function RunOverlay() {
  const r = useRun();
  const a = r.active;
  const [, tick] = useState(0);
  const [mini, setMini] = useState(false);
  const [flash, setFlash] = useState(false);
  const last = useRef<number>(-1);
  const lock = useRef<WakeLock | null>(null);

  useEffect(() => {
    if (!a || a.stoppedAt) return;
    const i = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [a]);

  // écran allumé pendant la séance (si l'appareil l'autorise)
  useEffect(() => {
    if (!a || a.stoppedAt) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => { lock.current = l; }).catch(() => undefined);
    void req();
    const onVis = () => { if (document.visibilityState === "visible") void req(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
  }, [a?.startedAt, a?.stoppedAt, a]);

  const s = a ? sessionOf(a.n) : undefined;
  const el = a ? elapsedSec(a) : 0;
  const pos = s ? positionAt(s, el) : undefined;

  // changement de bloc : flash + vibration (Android) ; fin automatique
  useEffect(() => {
    if (!a || !s || !pos || a.stoppedAt) return;
    if (pos.done) {
      r.stop();
      return;
    }
    if (last.current !== -1 && last.current !== pos.i) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
      try { (navigator as Navigator & { vibrate?: (p: number[]) => boolean }).vibrate?.([250, 120, 250]); } catch { /* non pris en charge */ }
    }
    last.current = pos.i;
  });
  useEffect(() => { last.current = -1; }, [a?.startedAt]);

  if (!a || !s || !pos) return null;
  const total = blocksTotal(s);
  const kind = pos.block.kind;
  const { rep, reps } = repOf(s, pos.i);
  const nextBlock = s.blocks[pos.i + 1];
  const ran = runSecAt(s, el);

  if (mini && !a.stoppedAt) {
    return (
      <button className={`run-pill k-${kind}`} onClick={() => setMini(false)}>
        <span className="fp-dot" />{WORD[kind]} · {mmss(pos.left)}
      </button>
    );
  }

  if (a.stoppedAt) {
    const done = completedAt(s, el);
    return (
      <div className="run done" role="dialog" aria-modal="true" aria-label="Fin de la séance de course">
        <div className="run-review">
          <span className="eyebrow">Séance {a.n} · {s.label}</span>
          <h2 className="run-h">{done ? "Séance terminée." : "Séance arrêtée."}</h2>
          <p className="muted">{done ? "Tu l'as fait. C'est exactement comme ça qu'on devient coureur : une séance après l'autre." : "Pas grave : elle sera refaite la prochaine fois. Le programme s'adapte à toi."}</p>
          <div className="run-kpis">
            <div><span>Couru</span><b>{human(ran)}</b></div>
            <div><span>Durée totale</span><b>{human(el)}</b></div>
          </div>
          <b>Comment c'était ?</b>
          <div className="feel">
            {([1, 2, 3, 4] as Feel[]).map((f) => (
              <button key={f} className={`feel-btn f${f}`} onClick={() => r.finish(f)}>{FEELS[f]}</button>
            ))}
          </div>
          <p className="muted small">« Trop dur / pas fini » : tu refais cette séance la prochaine fois. Sinon, tu passes à la suivante.</p>
          <button className="btn xs ghost" onClick={r.cancel}>Ne pas enregistrer</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`run k-${kind} ${flash ? "flash" : ""}`} role="dialog" aria-modal="true" aria-label="Séance de course">
      <div className="run-top">
        <span className="eyebrow">Séance {a.n} / 33 · semaine {s.week}</span>
        <button className="btn xs ghost" onClick={() => setMini(true)}>Réduire</button>
      </div>
      <div className="run-center">
        <span className="run-word">{WORD[kind]}</span>
        <span className="run-sub">{SUB[kind]}</span>
        <span className="run-clock num">{mmss(pos.left)}</span>
        {kind === "run" && <span className="run-rep">Course {rep}/{reps}</span>}
        {kind === "walk" && <span className="run-rep">{rep - 1}/{reps} courses faites</span>}
        {nextBlock && <span className="run-next">Ensuite : {WORD[nextBlock.kind].toLowerCase()} {human(nextBlock.sec)}</span>}
        {kind === "warm" && <p className="run-tip">{tipOf(a.n)}</p>}
        {a.pausedAt && <span className="run-paused">En pause</span>}
      </div>
      <div className="run-bar" aria-hidden>
        {s.blocks.map((b, i) => (
          <span key={i} className={`rb k-${b.kind} ${i < pos.i ? "past" : ""}`} style={{ flexGrow: b.sec }}>
            {i === pos.i && <span className="rb-fill" style={{ width: `${(pos.inBlock / b.sec) * 100}%` }} />}
          </span>
        ))}
      </div>
      <div className="run-foot">
        <span className="muted num">{mmss(el)} / {mmss(total)} · couru {human(ran)}</span>
        <div className="run-actions">
          {a.pausedAt ? <button className="btn primary" onClick={r.resume}>Reprendre</button> : <button className="btn" onClick={r.pause}>Pause</button>}
          <button className="btn ghost" onClick={r.skip}>Bloc suivant</button>
          <button className="btn danger-ghost" onClick={r.stop}>Arrêter</button>
        </div>
        <span className="muted small">Pas de son : l'écran reste allumé, un coup d'œil suffit. Sur Android, le téléphone vibre à chaque changement.</span>
      </div>
    </div>
  );
}
