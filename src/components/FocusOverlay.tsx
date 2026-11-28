/** Mode Focus plein écran : une seule chose à faire, le temps qui défile, le téléphone loin. */
import { useEffect, useState } from "react";
import { fmtDur, nowMin, toMin, today } from "../lib/dates";
import { elapsedMs, useFocus } from "../lib/focus";
import { expand, focusMusicUrl } from "../lib/model";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { useCats } from "./common";
import { CalLink } from "./CalLink";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function FocusOverlay() {
  const f = useFocus();
  const s = f.session;
  const plan = useStore((st) => st.plan);
  const minimized = useUI((u) => u.focusMin);
  const setMin = useUI((u) => u.setFocusMin);
  const cats = useCats();
  const music = focusMusicUrl(plan.prefs);
  const [, tick] = useState(0);
  const [mins, setMins] = useState<number | null>(null);

  useEffect(() => {
    if (!s) return;
    const i = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [s]);
  // fin automatique de la phase de travail
  useEffect(() => {
    if (s?.phase === "work" && !s.pausedAt && elapsedMs(s) >= s.plannedMin * 60000) f.finishWork();
  });
  useEffect(() => setMins(null), [s?.key, s?.phase]);
  if (!s) return null;

  const color = cats.get(s.cat)?.color ?? "var(--blue)";
  const el = elapsedMs(s);
  const total = (s.phase === "break" ? s.breakMin ?? 5 : s.plannedMin) * 60000;
  const left = total - el;
  const frac = Math.max(0, Math.min(1, el / total));
  const t = today();
  const next = expand(plan, t, t).find((o) => o.check && !o.done && o.key !== s.key && o.start && toMin(o.start) >= nowMin() - 30);

  if (minimized) {
    return (
      <button className="focus-pill" style={{ ["--c" as string]: color }} onClick={() => setMin(false)}>
        <span className="fp-dot" />{s.phase === "break" ? "Pause" : s.phase === "review" ? "À valider" : mmss(left)} · {s.title}
      </button>
    );
  }

  const R = 120;
  const C = 2 * Math.PI * R;
  return (
    <div className="focus" style={{ ["--c" as string]: color }} role="dialog" aria-modal="true" aria-label="Mode Focus">
      <div className="focus-top">
        <span className="eyebrow">{s.phase === "break" ? "Pause" : s.phase === "review" ? "Séance terminée" : "Mode Focus"}</span>
        <button className="btn xs ghost" onClick={() => setMin(true)}>Réduire</button>
      </div>

      {s.phase !== "review" && (
        <div className="focus-ring">
          <svg viewBox="0 0 280 280" aria-hidden>
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
            <circle cx="140" cy="140" r={R} fill="none" stroke={s.phase === "break" ? "var(--lime)" : "var(--c)"} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * frac} transform="rotate(-90 140 140)" />
          </svg>
          <div className="focus-time">
            <b>{mmss(left)}</b>
            <span>{s.pausedAt ? "en pause" : s.phase === "break" ? "lève-toi, bois de l'eau" : `sur ${s.plannedMin} min`}</span>
          </div>
        </div>
      )}

      <CalLink />
      {s.phase === "work" && music && (
        <a className="focus-music" href={music} target="_blank" rel="noopener noreferrer">
          <span className="fm-icon" aria-hidden>♫</span>
          <span><b>Lance ton jazz</b><small>YouTube · s'ouvre à côté, reviens ici ensuite</small></span>
        </a>
      )}

      <h2 className="focus-title">{s.phase === "break" ? (next ? `Ensuite : ${next.title}` : "Pause méritée") : s.title}</h2>
      {s.phase === "work" && s.notes && <p className="focus-notes">{s.notes}</p>}

      {s.phase === "work" && (
        <>
          <p className="focus-rule">Téléphone dans une autre pièce. Une seule chose : celle-ci.</p>
          <div className="focus-actions">
            <button className="btn big ghost" onClick={() => f.distract()}>J'ai décroché <span className="count">{s.distractions}</span></button>
            {s.pausedAt ? <button className="btn big" onClick={() => f.resume()}>Reprendre</button> : <button className="btn big" onClick={() => f.pause()}>Pause</button>}
            <button className="btn big primary" onClick={() => f.finishWork()}>J'ai fini</button>
          </div>
          <button className="btn xs ghost" onClick={() => f.stop()}>Abandonner la séance (rien n'est validé)</button>
        </>
      )}

      {s.phase === "review" && (
        <div className="focus-review">
          <p>Tu as travaillé <b>{fmtDur(s.workedMin ?? 0)}</b>{s.distractions ? ` avec ${s.distractions} décrochage${s.distractions > 1 ? "s" : ""}` : " sans décrocher"}.</p>
          <label className="inline-field big">Temps réellement fait
            <input id="fo-min" className="input sm" type="number" min={1} step={5} value={mins ?? s.workedMin ?? s.plannedMin} onChange={(e) => setMins(Number(e.target.value))} /> min
          </label>
          <div className="focus-actions">
            <button className="btn big ghost" onClick={() => f.stop()}>Ne pas valider</button>
            <button className="btn big primary" onClick={() => f.validate(mins ?? s.workedMin ?? s.plannedMin)}>✓ Valider et prendre 5 min de pause</button>
          </div>
        </div>
      )}

      {s.phase === "break" && (
        <div className="focus-actions">
          <button className="btn big ghost" onClick={() => f.stop()}>Terminer</button>
          {next && <button className="btn big primary" onClick={() => f.start(next)}>▶ Démarrer : {next.title.slice(0, 40)}</button>}
        </div>
      )}
    </div>
  );
}
