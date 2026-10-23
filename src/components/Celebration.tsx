/**
 * Célébrations : une scène courte et sobre quand quelque chose se passe (tâche bouclée, fin de session, travaux,
 * niveau). Onde lumineuse, pictogramme, gains qui défilent. Un tap la ferme.
 */
import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { clearBurst, useFx, type BurstKind, type Shooter } from "../lib/fx";

const GLYPH: Record<BurstKind, string> = {
  task: "M8 12.5l2.8 2.8L16.5 9.5",
  goal: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4l3.5 2.5-1.3 4h-4.4l-1.3-4z",
  build: "M4 20h16M6 20V10l6-4 6 4v10M10 20v-5h4v5",
  levelup: "M12 18V6M7 11l5-5 5 5",
};
const COLOR: Record<BurstKind, string> = { task: "#34d399", goal: "#38bdf8", build: "#fbbf24", levelup: "#a78bfa" };

/** Nombre qui défile jusqu'à sa valeur. */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function chime(kind: BurstKind) {
  try {
    const ctx = new AudioContext();
    const notes = kind === "levelup" ? [523, 659, 784, 1047] : kind === "goal" ? [587, 880] : [660, 990];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch {
    /* audio indisponible */
  }
}

export function Celebration() {
  const burst = useFx((s) => s.burst);
  const sound = useStore((s) => s.settings.sound);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!burst) return;
    setLeaving(false);
    if (sound) chime(burst.kind);
    const a = setTimeout(() => setLeaving(true), 2300);
    const b = setTimeout(clearBurst, 2700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [burst, sound]);
  if (!burst) return null;
  return (
    <div className={`celebrate ${leaving ? "out" : ""}`} onClick={clearBurst} role="status">
      <CelebrationCard key={burst.id} kind={burst.kind} title={burst.title} sub={burst.sub} xp={burst.xp} coins={burst.coins} shooter={burst.shooter} side={burst.side ?? 1} />
    </div>
  );
}

function CelebrationCard({ kind, title, sub, xp, coins, shooter, side }: { kind: BurstKind; title: string; sub?: string; xp?: number; coins?: number; shooter?: Shooter; side: -1 | 1 }) {
  const c = COLOR[kind];
  const vx = useCountUp(xp ?? 0, 1200);
  const vc = useCountUp(coins ?? 0, 1200);
  return (
    <div className={`celebrate-card ${shooter ? "wide" : ""}`} style={{ ["--c" as string]: c }}>
      {shooter ? <ShotScene shooter={shooter} side={side} /> : <div className="burst" aria-hidden>
        <span className="wave w1" /><span className="wave w2" /><span className="wave w3" />
        {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}
        <svg viewBox="0 0 24 24" className="glyph"><path d={GLYPH[kind]} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>}
      <div className="celebrate-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
      {(xp || coins) ? (
        <div className="gains">
          {xp ? <div><b>+{vx}</b><span>XP</span></div> : null}
          {coins ? <div><b>+{vc}</b><span>k€</span></div> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Frappe à l'entraînement : un joueur de l'effectif tire, le gardien plonge du mauvais côté, le filet tremble.
 * Vue de face façon tracés lumineux.
 */
function ShotScene({ shooter, side }: { shooter: Shooter; side: -1 | 1 }) {
  const tx = 160 + side * 58;
  const shot = `M160 168 Q ${160 + side * 34} 96 ${tx} 58`;
  return (
    <svg viewBox="0 0 320 200" className="shot" style={{ ["--dir" as string]: -side }} aria-hidden>
      <defs>
        <linearGradient id="shotpitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#04131c" /><stop offset="1" stopColor="#052e1f" /></linearGradient>
        <filter id="shotglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="320" height="200" rx="18" fill="url(#shotpitch)" />
      {/* lignes du terrain en perspective */}
      <g stroke="#34d39933" strokeWidth="1">
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => <line key={k} x1={160 + k * 18} y1="112" x2={160 + k * 70} y2="200" />)}
        {[128, 150, 178].map((y) => <line key={y} x1="0" y1={y} x2="320" y2={y} />)}
        <path d="M70 112 L50 150 L270 150 L250 112" fill="none" stroke="#34d39966" />
      </g>
      {/* but */}
      <g className="net">
        {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={88 + i * 18} y1="40" x2={88 + i * 18} y2="112" stroke="#e2e8f033" />)}
        {Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1="80" y1={52 + i * 14} x2="240" y2={52 + i * 14} stroke="#e2e8f033" />)}
      </g>
      <path d="M80 112 V36 H240 V112" fill="none" stroke="#f8fafc" strokeWidth="4" strokeLinejoin="round" filter="url(#shotglow)" />
      {/* gardien */}
      <g className="keeper">
        <rect x="150" y="76" width="20" height="34" rx="9" fill="#fbbf24" />
        <circle cx="160" cy="68" r="7" fill="#fde68a" />
        <rect x="134" y="80" width="52" height="7" rx="3.5" fill="#fbbf24" />
      </g>
      {/* trajectoire et ballon */}
      <path d={shot} fill="none" stroke="var(--c)" strokeWidth="3" strokeLinecap="round" className="trail" filter="url(#shotglow)" />
      <circle r="7" fill="#fff" stroke="#0f172a" strokeWidth="1.5">
        <animateMotion dur="0.55s" begin="0.45s" fill="freeze" path={shot} />
        <animate attributeName="r" from="8" to="4.5" dur="0.55s" begin="0.45s" fill="freeze" />
      </circle>
      {/* tireur */}
      <g className="shooter">
        <circle cx="160" cy="170" r="6" fill="#e2e8f0" />
        <rect x="150" y="176" width="20" height="22" rx="6" fill="var(--c)" />
        <text x="160" y="192" textAnchor="middle" fontSize="11" fontWeight="900" fill="#04131c">{shooter.num}</text>
      </g>
      <text x="160" y="28" textAnchor="middle" className="goal-flash" fontSize="22" fontWeight="900" fill="var(--c)" filter="url(#shotglow)">GOAL</text>
      <text x="14" y="190" fontSize="10" fontWeight="700" fill="#94a3b8">{shooter.pos} · {shooter.ovr}</text>
    </svg>
  );
}

/** Anneau de la journée : minutes travaillées / objectif, au centre de l'accueil. */
export function DayRing({ minutes, goal, running }: { minutes: number; goal: number; running: boolean }) {
  const pct = Math.min(1, goal ? minutes / goal : 0);
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className={`day-ring ${running ? "running" : ""} ${pct >= 1 ? "full" : ""}`}>
      <svg viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="64" cy="64" r={R} fill="none" stroke="url(#ringgrad)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 64 64)" style={{ transition: "stroke-dashoffset .8s ease" }} />
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-2, #38bdf8)" /></linearGradient>
        </defs>
      </svg>
      <div className="day-ring-c">
        <b>{Math.round(pct * 100)}%</b>
        <span>{Math.floor(minutes / 60)}h{String(Math.round(minutes % 60)).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
