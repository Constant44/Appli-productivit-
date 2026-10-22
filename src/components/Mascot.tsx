/**
 * Raoul, le rat mascotte du club. Il vit avec ta journée :
 * - il dort tant que tu n'as pas commencé, trottine pendant une session, applaudit quand l'objectif du jour est atteint ;
 * - il dévore son fromage quand tu boucles une tâche, marque un but à la fin d'une session, pose une brique après des travaux.
 */
import { useEffect, useId, useState } from "react";
import { useStore } from "../lib/store";
import { clearBurst, useFx, type BurstKind } from "../lib/fx";

export type Mood = "idle" | "sleep" | "run" | "cheer" | "eat" | "kick";

export function Rat({ mood = "idle", size = 120, jersey = "#22c55e", trim = "#0b1220" }: { mood?: Mood; size?: number; jersey?: string; trim?: string }) {
  const id = useId().replace(/:/g, "");
  const eyesClosed = mood === "sleep";
  return (
    <svg className={`rat rat-${mood}`} width={size} height={size * 0.78} viewBox="0 0 130 100" aria-hidden>
      <defs>
        <mask id={`bite-${id}`}>
          <rect x="0" y="0" width="130" height="100" fill="#fff" />
          {mood === "eat" && [0, 1, 2].map((i) => (
            <circle key={i} cx={124 - i * 7} cy={64 - (i % 2) * 4} r="0" fill="#000">
              <animate attributeName="r" from="0" to="6.5" begin={`${0.5 + i * 0.7}s`} dur="0.15s" fill="freeze" />
            </circle>
          ))}
        </mask>
      </defs>
      {/* ombre */}
      <ellipse cx="58" cy="94" rx="40" ry="5" fill="#0006" />
      {/* queue */}
      <path className="rat-tail" d="M30 78 C 12 80, 2 66, 10 52 S 22 40, 14 30" fill="none" stroke="#f9a8d4" strokeWidth="3.5" strokeLinecap="round" />
      <g className="rat-body">
        {/* pieds */}
        <ellipse className="foot f1" cx="44" cy="90" rx="8" ry="4" fill="#f9a8d4" />
        <ellipse className="foot f2" cx="68" cy="90" rx="8" ry="4" fill="#f9a8d4" />
        {/* corps + maillot */}
        <ellipse cx="56" cy="68" rx="30" ry="22" fill="#a1a1aa" />
        <path d="M30 62 Q56 44 82 62 L84 78 Q56 92 28 78 Z" fill={jersey} />
        <path d="M30 62 Q56 44 82 62" fill="none" stroke={trim} strokeWidth="2.5" />
        <text x="57" y="80" textAnchor="middle" fontSize="13" fontWeight="900" fill={trim}>9</text>
        {/* bras */}
        <g className="arm">
          <ellipse cx="94" cy="66" rx="7" ry="5" fill="#d4d4d8" />
        </g>
        {/* tête */}
        <g className="rat-head">
          <circle cx="74" cy="26" r="11" fill="#a1a1aa" />
          <circle cx="74" cy="26" r="6.5" fill="#f9a8d4" />
          <circle cx="92" cy="24" r="11" fill="#d4d4d8" />
          <circle cx="92" cy="24" r="6.5" fill="#fbcfe8" />
          <ellipse cx="88" cy="44" rx="20" ry="17" fill="#d4d4d8" />
          <ellipse cx="104" cy="50" rx="13" ry="9" fill="#d4d4d8" />
          <circle cx="116" cy="48" r="3.6" fill="#f472b6" />
          <circle cx="86" cy="50" r="4" fill="#fda4af" opacity="0.6" />
          {eyesClosed ? (
            <path d="M93 40 q4 3 8 0" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : (
            <g className="eye">
              <circle cx="97" cy="40" r="3.6" fill="#111" />
              <circle cx="98.2" cy="38.8" r="1.2" fill="#fff" />
            </g>
          )}
          <g stroke="#52525b" strokeWidth="0.9" strokeLinecap="round">
            <line x1="110" y1="53" x2="126" y2="50" />
            <line x1="110" y1="55" x2="126" y2="57" />
          </g>
          {mood === "eat" && <path className="jaw" d="M104 57 q6 4 12 0" stroke="#71717a" strokeWidth="1.6" fill="none" />}
          {(mood === "cheer" || mood === "kick") && <path d="M101 55 q6 6 13 0" stroke="#7f1d1d" strokeWidth="1.8" fill="#fca5a5" />}
        </g>
        {/* fromage */}
        {mood === "eat" && (
          <g transform="translate(112 72) scale(1.45) translate(-112 -72)">
          <g mask={`url(#bite-${id})`} className="cheese">
            <polygon points="100,74 128,62 126,82 102,84" fill="#fbbf24" />
            <polygon points="100,74 128,62 124,60 98,70" fill="#fde68a" />
            <circle cx="110" cy="76" r="2.4" fill="#f59e0b" />
            <circle cx="119" cy="72" r="1.7" fill="#f59e0b" />
            <circle cx="114" cy="80" r="1.3" fill="#f59e0b" />
          </g>
          </g>
        )}
        {mood === "eat" && [0, 1, 2, 3].map((i) => <circle key={i} className={`crumb c${i}`} cx={112 + i * 3} cy={70} r="1.3" fill="#fbbf24" />)}
      </g>
      {mood === "sleep" && (
        <g className="zzz" fill="#cbd5e1" fontWeight="900">
          <text x="104" y="16" fontSize="11">z</text>
          <text x="112" y="8" fontSize="8">z</text>
        </g>
      )}
      {mood === "kick" && <circle className="ball" cx="104" cy="88" r="6" fill="#fff" stroke="#111" strokeWidth="1.2" />}
    </svg>
  );
}

/** Humeur de Raoul selon la journée. */
export function useMood(): Mood {
  const timer = useStore((s) => s.timer);
  const sessions = useStore((s) => s.sessions);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const today = new Date().toDateString();
  const minutes = sessions.filter((x) => new Date(x.start).toDateString() === today).reduce((a, b) => a + b.minutes, 0);
  if (timer.status === "running" && timer.phase === "work") return "run";
  if (minutes >= goal) return "cheer";
  if (minutes === 0) return "sleep";
  return "idle";
}

function munch() {
  try {
    const ctx = new AudioContext();
    [0.5, 1.2, 1.9].forEach((t) => {
      const len = 0.09;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = "bandpass";
      f.frequency.value = 1800;
      g.gain.value = 0.25;
      src.buffer = buf;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(ctx.currentTime + t);
    });
  } catch {
    /* audio indisponible */
  }
}

const MOOD_OF: Record<BurstKind, Mood> = { cheese: "eat", goal: "kick", build: "cheer", levelup: "cheer" };

/** Scène plein écran courte quand quelque chose se passe. Un tap la ferme. */
export function Celebration() {
  const burst = useFx((s) => s.burst);
  const club = useStore((s) => s.club);
  const sound = useStore((s) => s.settings.sound);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!burst) return;
    setLeaving(false);
    if (sound && burst.kind === "cheese") munch();
    const a = setTimeout(() => setLeaving(true), burst.kind === "cheese" ? 2900 : 2400);
    const b = setTimeout(clearBurst, burst.kind === "cheese" ? 3300 : 2800);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [burst, sound]);
  if (!burst) return null;
  return (
    <div className={`celebrate ${leaving ? "out" : ""}`} onClick={clearBurst} role="status">
      <div className="celebrate-card" key={burst.id}>
        <div className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</div>
        <Rat mood={MOOD_OF[burst.kind]} size={150} jersey={club.colorA} trim={club.colorB} />
        <div className="celebrate-text">
          <b>{burst.title}</b>
          {burst.sub && <span>{burst.sub}</span>}
        </div>
      </div>
    </div>
  );
}
