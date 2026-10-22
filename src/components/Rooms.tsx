/**
 * Pièces du club en perspective (point de fuite central) : hall, bibliothèque, bureau du coach.
 * Matériaux en dégradés, ombres douces, lumière des fenêtres selon l'heure (jour, fin de journée, nuit + lampes).
 * Chaque objet utile est cliquable et mène à l'écran correspondant.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "../lib/store";

export type RoomId = "hall" | "library" | "office";
export type RoomSpot = { key: string; label: string; icon: string; onClick: () => void };

const W = 1600, H = 1000;
// Mur du fond et point de fuite
const BX0 = 420, BX1 = 1180, BY0 = 170, BY1 = 700;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pt = (p: readonly [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poly = (...ps: Array<readonly [number, number]>) => ps.map(pt).join(" ");
/** Point du mur gauche : u = profondeur (0 devant, 1 fond), v = hauteur (0 sol, 1 plafond). */
const LW = (u: number, v: number) => [BX0 * u, lerp(lerp(H, BY1, u), lerp(0, BY0, u), v)] as const;
const RW = (u: number, v: number) => [W - (W - BX1) * u, lerp(lerp(H, BY1, u), lerp(0, BY0, u), v)] as const;
/** Point du sol : x = position latérale (0 gauche, 1 droite), d = profondeur (0 devant, 1 fond). */
const FL = (x: number, d: number) => [lerp(lerp(0, BX0, d), lerp(W, BX1, d), x), lerp(H, BY1, d)] as const;
const scaleAt = (d: number) => lerp(1, (BX1 - BX0) / W, d);

const hash = (n: number) => {
  const x = Math.sin(n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Meuble posé au sol : dessus, face avant et face latérale visible. */
function FloorBox({ x0, x1, d0, d1, h, top, front, side, children }: { x0: number; x1: number; d0: number; d1: number; h: number; top: string; front: string; side: string; children?: ReactNode }) {
  const up = (p: readonly [number, number], d: number) => [p[0], p[1] - h * scaleAt(d)] as const;
  const fl = FL(x0, d0), fr = FL(x1, d0), bl = FL(x0, d1), br = FL(x1, d1);
  const cx = (FL(x0, d0)[0] + FL(x1, d0)[0]) / 2;
  const showRight = cx < W / 2; // à gauche du centre on voit le flanc droit
  return (
    <g>
      <ellipse cx={cx} cy={fl[1] + 6} rx={(fr[0] - fl[0]) * 0.58} ry={14} fill="#000" opacity="0.28" filter="url(#soft)" />
      {showRight
        ? <polygon points={poly(fr, br, up(br, d1), up(fr, d0))} fill={side} />
        : <polygon points={poly(fl, bl, up(bl, d1), up(fl, d0))} fill={side} />}
      <polygon points={poly(up(fl, d0), up(fr, d0), up(br, d1), up(bl, d1))} fill={top} />
      <polygon points={poly(fl, fr, up(fr, d0), up(fl, d0))} fill={front} />
      {children}
    </g>
  );
}

function Shell({ wall, wallDark, floor, floorDark, ceil, wainscot, night }: { wall: string; wallDark: string; floor: string; floorDark: string; ceil: string; wainscot?: string; night: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="r-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={wall} /><stop offset="1" stopColor={wallDark} /></linearGradient>
        <linearGradient id="r-left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={wallDark} /><stop offset="1" stopColor={wall} /></linearGradient>
        <linearGradient id="r-right" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor={wallDark} /><stop offset="1" stopColor={wall} /></linearGradient>
        <linearGradient id="r-floor" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={floorDark} /><stop offset="1" stopColor={floor} /></linearGradient>
        <linearGradient id="r-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ceil} /><stop offset="1" stopColor="#ffffff" stopOpacity="0.9" /></linearGradient>
        <radialGradient id="r-vignette" cx="50%" cy="48%" r="70%"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity={night ? 0.65 : 0.38} /></radialGradient>
        <filter id="soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.35" /></filter>
      </defs>
      <polygon points={poly([0, 0], [W, 0], [BX1, BY0], [BX0, BY0])} fill="url(#r-ceil)" />
      <polygon points={poly([BX0, BY0], [BX1, BY0], [BX1, BY1], [BX0, BY1])} fill="url(#r-back)" />
      <polygon points={poly([0, 0], [BX0, BY0], [BX0, BY1], [0, H])} fill="url(#r-left)" />
      <polygon points={poly([W, 0], [BX1, BY0], [BX1, BY1], [W, H])} fill="url(#r-right)" />
      {wainscot && (
        <g opacity="0.95">
          <polygon points={poly([BX0, BY1 - 120], [BX1, BY1 - 120], [BX1, BY1], [BX0, BY1])} fill={wainscot} />
          <polygon points={poly(LW(0, 0), LW(1, 0), LW(1, 0.226), LW(0, 0.226))} fill={wainscot} />
          <polygon points={poly(RW(0, 0), RW(1, 0), RW(1, 0.226), RW(0, 0.226))} fill={wainscot} />
        </g>
      )}
      <polygon points={poly([0, H], [BX0, BY1], [BX1, BY1], [W, H])} fill="url(#r-floor)" />
      {/* arêtes adoucies (occlusion ambiante) */}
      <g stroke="#000" strokeOpacity="0.18" strokeWidth="10" filter="url(#soft)" fill="none">
        <polyline points={poly([0, 0], [BX0, BY0], [BX1, BY0], [W, 0])} />
        <polyline points={poly([0, H], [BX0, BY1], [BX1, BY1], [W, H])} />
        <line x1={BX0} y1={BY0} x2={BX0} y2={BY1} />
        <line x1={BX1} y1={BY0} x2={BX1} y2={BY1} />
      </g>
    </g>
  );
}

/** Lames de parquet en perspective. */
const Planks = ({ color = "#000", opacity = 0.14 }: { color?: string; opacity?: number }) => (
  <g stroke={color} strokeOpacity={opacity} strokeWidth="2">
    {Array.from({ length: 17 }, (_, i) => { const x = i / 16; return <line key={i} x1={FL(x, 0)[0]} y1={H} x2={FL(x, 1)[0]} y2={BY1} />; })}
    {Array.from({ length: 9 }, (_, i) => { const d = 1 - Math.pow(1 - (i + 1) / 10, 1.6); const a = FL(0, d), b = FL(1, d); return <line key={`h${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeOpacity={opacity * 0.6} />; })}
  </g>
);

function Sky({ x, y, w, h, tod, kind }: { x: number; y: number; w: number; h: number; tod: Tod; kind: "stadium" | "city" | "garden" }) {
  const id = `sky-${kind}`;
  const sky = tod === "night" ? ["#0a1330", "#1e2a5a"] : tod === "dusk" ? ["#3b2a6b", "#f59e0b"] : ["#5aa9e6", "#d7ecfb"];
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
        <clipPath id={`${id}-c`}><rect x={x} y={y} width={w} height={h} /></clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}-c)`}>
        {tod === "night" && Array.from({ length: 26 }, (_, i) => <circle key={i} cx={x + hash(i + 3) * w} cy={y + hash(i + 40) * h * 0.45} r={1 + hash(i) * 1.4} fill="#fff" opacity={0.5 + hash(i + 9) * 0.5} />)}
        {tod === "day" && <g className="cloud c1" opacity="0.85"><ellipse cx={x + w * 0.25} cy={y + h * 0.18} rx="70" ry="18" fill="#fff" /><ellipse cx={x + w * 0.3} cy={y + h * 0.14} rx="40" ry="16" fill="#fff" /></g>}
        {kind === "stadium" && (
          <g>
            <path d={`M${x} ${y + h} L${x} ${y + h * 0.5} Q${x + w / 2} ${y + h * 0.3} ${x + w} ${y + h * 0.5} L${x + w} ${y + h} Z`} fill={tod === "night" ? "#1f2937" : "#4b5563"} />
            {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${x} ${y + h * (0.55 + i * 0.05)} Q${x + w / 2} ${y + h * (0.36 + i * 0.05)} ${x + w} ${y + h * (0.55 + i * 0.05)}`} stroke={tod === "night" ? "#374151" : "#6b7280"} strokeWidth="3" fill="none" />)}
            <path d={`M${x + w * 0.05} ${y + h} Q${x + w / 2} ${y + h * 0.66} ${x + w * 0.95} ${y + h} Z`} fill={tod === "night" ? "#15803d" : "#22a05a"} />
            <path d={`M${x + w * 0.05} ${y + h} Q${x + w / 2} ${y + h * 0.66} ${x + w * 0.95} ${y + h}`} stroke="#fff" strokeOpacity="0.5" strokeWidth="3" fill="none" />
            {[0.12, 0.88].map((f, i) => (
              <g key={i}>
                <rect x={x + w * f - 3} y={y + h * 0.12} width="6" height={h * 0.38} fill="#94a3b8" />
                <rect x={x + w * f - 26} y={y + h * 0.08} width="52" height="18" rx="3" fill={tod === "day" ? "#e5e7eb" : "#fef9c3"} />
                {tod !== "day" && <ellipse cx={x + w * f} cy={y + h * 0.1} rx="60" ry="30" fill="#fef9c3" opacity="0.45" filter="url(#glow)" />}
              </g>
            ))}
          </g>
        )}
        {kind === "city" && Array.from({ length: 10 }, (_, i) => {
          const bw = w / 10, bh = h * (0.28 + hash(i + 2) * 0.42);
          return (
            <g key={i}>
              <rect x={x + i * bw} y={y + h - bh} width={bw - 4} height={bh} fill={tod === "night" ? "#111827" : tod === "dusk" ? "#4c1d95" : "#7b8794"} />
              {Array.from({ length: 8 }, (_, j) => <rect key={j} x={x + i * bw + 6 + (j % 2) * 14} y={y + h - bh + 10 + Math.floor(j / 2) * 18} width="8" height="9" fill={tod === "day" ? "#cbd5e1" : "#fde68a"} opacity={tod === "day" ? 0.5 : hash(i * 9 + j) > 0.45 ? 0.95 : 0.15} />)}
            </g>
          );
        })}
        {kind === "garden" && (
          <g>
            <rect x={x} y={y + h * 0.72} width={w} height={h * 0.28} fill={tod === "night" ? "#14361f" : "#3f7d45"} />
            {Array.from({ length: 5 }, (_, i) => <circle key={i} cx={x + (i + 0.5) * (w / 5)} cy={y + h * 0.66} r={w / 7} fill={tod === "night" ? "#1b4d2b" : "#4f9a56"} />)}
          </g>
        )}
      </g>
    </g>
  );
}

/** Faisceau de lumière qui tombe d'une fenêtre sur le sol. */
const LightShaft = ({ x, y, w, h, tod }: { x: number; y: number; w: number; h: number; tod: Tod }) =>
  tod === "night" ? null : (
    <polygon points={poly([x, y + h], [x + w, y + h], [x + w * 1.5, H], [x - w * 0.3, H])} fill={tod === "dusk" ? "#fbbf24" : "#fff8e1"} opacity={tod === "dusk" ? 0.16 : 0.12} style={{ mixBlendMode: "screen" }} />
  );

const Lamp = ({ x, y, on, shade = "#166534" }: { x: number; y: number; on: boolean; shade?: string }) => (
  <g>
    {on && <ellipse cx={x} cy={y + 40} rx="150" ry="70" fill="#ffd27a" opacity="0.5" filter="url(#glow)" />}
    <rect x={x - 26} y={y + 52} width="52" height="10" rx="4" fill="#a16207" />
    <rect x={x - 3} y={y + 10} width="6" height="44" fill="#a16207" />
    <path d={`M${x - 46} ${y + 14} Q${x} ${y - 22} ${x + 46} ${y + 14} Z`} fill={shade} />
    <path d={`M${x - 46} ${y + 14} L${x + 46} ${y + 14}`} stroke={on ? "#fde68a" : "#0003"} strokeWidth="4" />
  </g>
);

const Plant = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="58" rx="46" ry="10" fill="#000" opacity="0.3" filter="url(#soft)" />
    <path d="M-30 0 L30 0 L22 58 L-22 58 Z" fill="#e7e1d6" />
    <path d="M-30 0 L30 0 L28 10 L-28 10 Z" fill="#cfc6b8" />
    {[-55, -32, -12, 8, 28, 50].map((a, i) => <path key={i} className="sway" d="M0 4 C -10 -60, 10 -100, 0 -130" stroke={i % 2 ? "#2f7d3a" : "#3f9a4a"} strokeWidth="16" strokeLinecap="round" fill="none" transform={`rotate(${a})`} />)}
  </g>
);

const Trophy = ({ x, y, s = 1, c = "#f5c542" }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <defs><linearGradient id={`tg-${c}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c} /><stop offset="0.45" stopColor="#fff" stopOpacity="0.8" /><stop offset="1" stopColor={c} /></linearGradient></defs>
    <path d="M-22 -64 H22 V-44 C22 -24 10 -16 0 -16 C-10 -16 -22 -24 -22 -44 Z" fill={`url(#tg-${c})`} />
    <path d="M-22 -58 C-38 -58 -38 -36 -18 -32 M22 -58 C38 -58 38 -36 18 -32" stroke={c} strokeWidth="5" fill="none" />
    <rect x="-5" y="-16" width="10" height="12" fill={c} />
    <rect x="-16" y="-4" width="32" height="10" rx="2" fill="#3f2a14" />
  </g>
);

function Tag({ x, y, spot }: { x: number; y: number; spot: RoomSpot }) {
  const w = 54 + spot.label.length * 13.5;
  return (
    <g className="room-tag" transform={`translate(${x} ${y})`}>
      <circle r="9" fill="#fff" className="tag-pulse" />
      <circle r="9" fill="#fff" />
      <g transform="translate(0 -58)">
        <rect x={-w / 2} y="-26" width={w} height="52" rx="26" fill="#0b1120" fillOpacity="0.86" stroke="#ffffff" strokeOpacity="0.25" />
        <text x={-w / 2 + 22} y="9" fontSize="26">{spot.icon}</text>
        <text x={-w / 2 + 58} y="9" fontSize="24" fontWeight="700" fill="#fff">{spot.label}</text>
      </g>
      <line x1="0" y1="-9" x2="0" y2="-32" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" />
    </g>
  );
}

/** Objet cliquable : léger éclaircissement au survol, étiquette toujours visible. */
function Hot({ spot, tx, ty, children }: { spot?: RoomSpot; tx: number; ty: number; children: ReactNode }) {
  if (!spot) return <>{children}</>;
  return (
    <g className="room-hot" role="button" tabIndex={0} aria-label={spot.label} onClick={spot.onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), spot.onClick())}>
      {children}
      <Tag x={tx} y={ty} spot={spot} />
    </g>
  );
}

type Tod = "day" | "dusk" | "night";
type Ctx = { tod: Tod; s: Record<string, RoomSpot>; a: string; b: string; info: Record<string, string> };

// ---------------- Hall du club ----------------
function Hall({ tod, s, a, b, info }: Ctx) {
  const night = tod === "night";
  return (
    <g>
      <Shell wall="#e4e0d8" wallDark="#b9b3a8" floor="#b8bcc4" floorDark="#5d636e" ceil="#d9d6cf" night={night} />
      {/* reflets du sol poli */}
      <polygon points={poly([0, H], [BX0, BY1], [BX1, BY1], [W, H])} fill="url(#hall-sheen)" />
      <defs>
        <linearGradient id="hall-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.25" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id="desk-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor="#0b1120" /></linearGradient>
      </defs>
      {/* spots au plafond */}
      {[0.25, 0.5, 0.75].map((x, i) => { const p = [lerp(300, 1300, x), 70] as const; return <g key={i}><ellipse cx={p[0]} cy={p[1]} rx="38" ry="9" fill="#fff" /><ellipse cx={p[0]} cy={p[1] + 30} rx="90" ry="40" fill="#fff8e1" opacity={night ? 0.35 : 0.18} filter="url(#glow)" /></g>; })}
      {/* écusson au-dessus de la baie */}
      <g transform="translate(800 202)">
        <path d="M0 -24 L22 -17 V-1 C22 13 11 20 0 24 C-11 20 -22 13 -22 -1 V-17 Z" fill={b} stroke={a} strokeWidth="4" />
        <path d="M0 -17 V18" stroke={a} strokeWidth="8" />
      </g>
      <text x="800" y="246" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="8" fill="#6b6459">PRÉPA FC · DEPUIS 2025</text>
      {/* baie vitrée sur le stade */}
      <Hot spot={s.window} tx={800} ty={330}>
        <g>
          <rect x="496" y="258" width="608" height="412" fill="#2a2f38" />
          <Sky x={506} y={268} w={588} h={392} tod={tod} kind="stadium" />
          {[0.25, 0.5, 0.75].map((f, i) => <rect key={i} x={506 + 588 * f - 4} y="268" width="8" height="392" fill="#2a2f38" />)}
          <rect x="506" y="268" width="588" height="392" fill="url(#glass)" />
          <defs><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.16" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="0.52" stopColor="#fff" stopOpacity="0.08" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        </g>
      </Hot>
      <LightShaft x={506} y={268} w={588} h={392} tod={tod} />
      {/* porte des vestiaires (mur gauche) */}
      <Hot spot={s.door} tx={LW(0.6, 0.62)[0]} ty={LW(0.6, 0.62)[1] - 10}>
        <g>
          <polygon points={poly(LW(0.45, 0), LW(0.75, 0), LW(0.75, 0.56), LW(0.45, 0.56))} fill="#3a3f47" />
          <polygon points={poly(LW(0.47, 0.02), LW(0.73, 0.02), LW(0.73, 0.54), LW(0.47, 0.54))} fill="#4b515b" />
          <polygon points={poly(LW(0.66, 0.25), LW(0.69, 0.25), LW(0.69, 0.27), LW(0.66, 0.27))} fill="#d4a017" />
          <polygon points={poly(LW(0.47, 0.6), LW(0.73, 0.6), LW(0.73, 0.67), LW(0.47, 0.67))} fill="#0b1120" />
          <text x={LW(0.6, 0.635)[0]} y={LW(0.6, 0.635)[1] + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#34d399" letterSpacing="1">VESTIAIRES</text>
        </g>
      </Hot>
      {/* vitrine à trophées (mur droit) */}
      <Hot spot={s.cabinet} tx={RW(0.28, 0.82)[0]} ty={RW(0.28, 0.82)[1]}>
        <g>
          <polygon points={poly(RW(0.1, 0.02), RW(0.48, 0.02), RW(0.48, 0.78), RW(0.1, 0.78))} fill="#2b2118" />
          <polygon points={poly(RW(0.12, 0.05), RW(0.46, 0.05), RW(0.46, 0.75), RW(0.12, 0.75))} fill="#3b2d1f" />
          <polygon points={poly(RW(0.12, 0.05), RW(0.46, 0.05), RW(0.46, 0.75), RW(0.12, 0.75))} fill="#fff1c1" opacity={night ? 0.22 : 0.12} />
          {[0.3, 0.52].map((v, i) => <polygon key={i} points={poly(RW(0.12, v), RW(0.46, v), RW(0.46, v + 0.012), RW(0.12, v + 0.012))} fill="#d6c7a8" />)}
          {[[0.2, 0.3, 1.25], [0.36, 0.3, 1], [0.24, 0.52, 0.95, "#e5e7eb"], [0.38, 0.52, 0.8, "#cd7f32"]].map(([u, v, sc, c], i) => { const p = RW(u as number, v as number); return <Trophy key={i} x={p[0]} y={p[1]} s={(sc as number) * lerp(1.3, 0.8, u as number)} c={c as string | undefined} />; })}
        </g>
      </Hot>
      {/* écran : compte à rebours EDHEC (mur droit, au fond) */}
      <Hot spot={s.screen} tx={RW(0.74, 0.74)[0]} ty={RW(0.74, 0.74)[1]}>
        <g>
          <polygon points={poly(RW(0.6, 0.42), RW(0.88, 0.42), RW(0.88, 0.66), RW(0.6, 0.66))} fill="#0b0f17" />
          <polygon points={poly(RW(0.615, 0.44), RW(0.865, 0.44), RW(0.865, 0.64), RW(0.615, 0.64))} fill="#0f2a44" />
          <text x={RW(0.74, 0.56)[0]} y={RW(0.74, 0.56)[1]} textAnchor="middle" fontSize="30" fontWeight="900" fill="#fbbf24">{info.edhec}</text>
          <text x={RW(0.74, 0.5)[0]} y={RW(0.74, 0.5)[1] + 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="#93c5fd" letterSpacing="2">EDHEC</text>
        </g>
      </Hot>
      {/* banque d'accueil */}
      <Hot spot={s.desk} tx={800} ty={FL(0.5, 0.32)[1] - 190}>
        <FloorBox x0={0.34} x1={0.66} d0={0.2} d1={0.36} h={150} top="#f2efe9" front="url(#desk-front)" side="#2a2f38">
          <g transform={`translate(800 ${FL(0.5, 0.2)[1] - 70})`}>
            <path d="M0 -30 L26 -21 V-1 C26 16 13 24 0 30 C-13 24 -26 16 -26 -1 V-21 Z" fill={b} stroke="#fff" strokeOpacity="0.6" strokeWidth="3" />
            <path d="M0 -21 V22" stroke={a} strokeWidth="9" />
          </g>
          <rect x="690" y={FL(0.5, 0.36)[1] - 150 * scaleAt(0.36) - 46} width="120" height="44" rx="6" fill="#111827" />
          <rect x="696" y={FL(0.5, 0.36)[1] - 150 * scaleAt(0.36) - 40} width="108" height="32" rx="3" fill="#1e3a5f" />
          <text x="750" y={FL(0.5, 0.36)[1] - 150 * scaleAt(0.36) - 18} textAnchor="middle" fontSize="13" fontWeight="800" fill="#34d399">{info.today}</text>
        </FloorBox>
      </Hot>
      <Plant x={190} y={820} s={1.35} />
      <Plant x={1440} y={830} s={1.25} />
      {/* banc */}
      <FloorBox x0={0.8} x1={0.93} d0={0.42} d1={0.5} h={46} top="#8a6a48" front="#5d462f" side="#4a3826" />
      {night && <rect width={W} height={H} fill="#0b1026" opacity="0.32" />}
      <rect width={W} height={H} fill="url(#r-vignette)" pointerEvents="none" />
    </g>
  );
}

// ---------------- Bibliothèque ----------------
const BOOK = ["#7f1d1d", "#1e3a8a", "#14532d", "#a16207", "#e7dcc4", "#3f3f46", "#9a3412", "#0f766e", "#581c87", "#b45309"];
function BookRows({ x, y, w, rows, seed }: { x: number; y: number; w: number; rows: number; seed: number }) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    let cx = x + 6, i = 0;
    const by = y + r * 80;
    out.push(<rect key={`s${r}`} x={x} y={by + 70} width={w} height="10" fill="#5b3a1e" />);
    while (cx < x + w - 14) {
      const bw = 12 + hash(seed * 7 + r * 31 + i) * 14;
      const bh = 50 + hash(seed * 13 + r * 17 + i) * 18;
      const lean = hash(seed + r * 3 + i * 11) > 0.93;
      const col = BOOK[Math.floor(hash(seed * 3 + r * 5 + i * 7) * BOOK.length)];
      out.push(
        <g key={`${r}-${i}`} transform={lean ? `rotate(-12 ${cx} ${by + 70})` : undefined}>
          <rect x={cx} y={by + 70 - bh} width={bw} height={bh} fill={col} />
          <rect x={cx} y={by + 70 - bh} width={bw * 0.25} height={bh} fill="#fff" opacity="0.12" />
          <rect x={cx + 2} y={by + 70 - bh + 10} width={bw - 4} height="3" fill="#f5d27a" opacity="0.55" />
        </g>,
      );
      cx += bw + 1.5 + (hash(seed + i) > 0.9 ? 10 : 0);
      i++;
    }
  }
  return <g>{out}</g>;
}

function Library({ tod, s, info }: Ctx) {
  const night = tod === "night";
  return (
    <g>
      <Shell wall="#e9dcc4" wallDark="#bfa98a" floor="#a86f3e" floorDark="#4a2c14" ceil="#e6dccb" wainscot="#5b3a1e" night={night} />
      <Planks opacity={0.18} />
      {/* bibliothèques du fond */}
      <rect x="436" y="186" width="276" height="514" fill="#4a2f17" />
      <rect x="888" y="186" width="276" height="514" fill="#4a2f17" />
      <BookRows x={446} y={196} w={256} rows={6} seed={3} />
      <BookRows x={898} y={196} w={256} rows={6} seed={11} />
      {/* fenêtre en arc */}
      <g>
        <path d="M730 690 V320 Q800 240 870 320 V690 Z" fill="#3b2a1a" />
        <clipPath id="arch"><path d="M740 680 V322 Q800 254 860 322 V680 Z" /></clipPath>
        <g clipPath="url(#arch)"><Sky x={740} y={250} w={120} h={430} tod={tod} kind="garden" /></g>
        <line x1="800" y1="262" x2="800" y2="680" stroke="#3b2a1a" strokeWidth="6" />
        <line x1="740" y1="470" x2="860" y2="470" stroke="#3b2a1a" strokeWidth="6" />
      </g>
      <LightShaft x={740} y={300} w={120} h={380} tod={tod} />
      {/* horloge → planning */}
      <Hot spot={s.clock} tx={800} ty={255}>
        <g>
          <circle cx="800" cy="215" r="34" fill="#f8f4ea" stroke="#7a5230" strokeWidth="6" />
          {Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return <line key={i} x1={800 + Math.sin(t) * 24} y1={215 - Math.cos(t) * 24} x2={800 + Math.sin(t) * 28} y2={215 - Math.cos(t) * 28} stroke="#3f2a14" strokeWidth="2" />; })}
          <line x1="800" y1="215" x2="800" y2="192" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" className="clock-m" />
          <line x1="800" y1="215" x2="814" y2="221" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        </g>
      </Hot>
      {/* affiche EDHEC (mur gauche) */}
      <Hot spot={s.poster} tx={LW(0.52, 0.86)[0]} ty={LW(0.52, 0.86)[1]}>
        <g>
          <polygon points={poly(LW(0.35, 0.38), LW(0.7, 0.38), LW(0.7, 0.8), LW(0.35, 0.8))} fill="#2a1d10" />
          <polygon points={poly(LW(0.37, 0.41), LW(0.68, 0.41), LW(0.68, 0.77), LW(0.37, 0.77))} fill="#8a1c1c" />
          <polygon points={poly(LW(0.37, 0.41), LW(0.68, 0.41), LW(0.68, 0.5), LW(0.37, 0.5))} fill="#f3e9d2" />
          <text x={LW(0.52, 0.62)[0]} y={LW(0.52, 0.62)[1]} textAnchor="middle" fontSize="30" fontWeight="900" fill="#f3e9d2">EDHEC</text>
          <text x={LW(0.52, 0.53)[0]} y={LW(0.52, 0.53)[1]} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fde68a">{info.edhec}</text>
        </g>
      </Hot>
      {/* rayonnage du mur droit */}
      <polygon points={poly(RW(0.15, 0.05), RW(0.85, 0.05), RW(0.85, 0.85), RW(0.15, 0.85))} fill="#4a2f17" />
      {Array.from({ length: 5 }, (_, r) => (
        <g key={r}>
          {Array.from({ length: 22 }, (_, i) => { const u0 = 0.17 + i * 0.03, u1 = u0 + 0.024, v0 = 0.1 + r * 0.15, v1 = v0 + 0.1 + hash(i + r * 9) * 0.03; return <polygon key={i} points={poly(RW(u0, v0), RW(u1, v0), RW(u1, v1), RW(u0, v1))} fill={BOOK[Math.floor(hash(i * 3 + r * 7) * BOOK.length)]} />; })}
          <polygon points={poly(RW(0.15, 0.08 + r * 0.15), RW(0.85, 0.08 + r * 0.15), RW(0.85, 0.095 + r * 0.15), RW(0.15, 0.095 + r * 0.15))} fill="#2b1a0b" />
        </g>
      ))}
      {/* tapis */}
      <polygon points={poly(FL(0.18, 0.08), FL(0.82, 0.08), FL(0.82, 0.62), FL(0.18, 0.62))} fill="#6b1d1d" />
      <polygon points={poly(FL(0.21, 0.12), FL(0.79, 0.12), FL(0.79, 0.58), FL(0.21, 0.58))} fill="none" stroke="#d4a373" strokeWidth="4" opacity="0.7" />
      {/* table de lecture */}
      <FloorBox x0={0.24} x1={0.76} d0={0.24} d1={0.44} h={118} top="#7a4a22" front="#4e2e13" side="#3b220e" />
      {(() => {
        const ty = FL(0.5, 0.34)[1] - 118 * scaleAt(0.34);
        return (
          <g>
            <Lamp x={800} y={ty - 64} on={tod !== "day"} />
            <Hot spot={s.cards} tx={600} ty={ty - 70}>
              <g filter="url(#shadow)">
                {[0, 1, 2, 3].map((i) => <rect key={i} x={548 + i * 3} y={ty - 22 - i * 6} width="104" height="62" rx="6" fill={["#fde68a", "#bfdbfe", "#fecaca", "#fff"][i]} stroke="#0002" transform={`rotate(${-6 + i * 2} 600 ${ty})`} />)}
                <text x="603" y={ty - 2} textAnchor="middle" fontSize="26">🔥</text>
              </g>
            </Hot>
            <Hot spot={s.paper} tx={1000} ty={ty - 74}>
              <g transform={`rotate(5 1000 ${ty})`} filter="url(#shadow)">
                <rect x="930" y={ty - 30} width="150" height="58" fill="#f4f1ea" />
                <text x="940" y={ty - 10} fontSize="15" fontWeight="900" fontFamily="Georgia, serif" fill="#111">Le Monde</text>
                {[0, 1, 2].map((i) => <rect key={i} x="940" y={ty - 2 + i * 8} width={120 - i * 22} height="3" fill="#9ca3af" />)}
              </g>
            </Hot>
            <path d={`M760 ${ty + 10} Q780 ${ty - 6} 800 ${ty + 6} Q820 ${ty - 6} 840 ${ty + 10} L840 ${ty + 18} Q820 ${ty + 6} 800 ${ty + 14} Q780 ${ty + 6} 760 ${ty + 18} Z`} fill="#fbf7ee" stroke="#c9b48f" />
          </g>
        );
      })()}
      <Plant x={150} y={840} s={1.3} />
      {night && <rect width={W} height={H} fill="#0b1026" opacity="0.38" />}
      {tod !== "day" && <ellipse cx="800" cy={FL(0.5, 0.34)[1] - 140} rx="320" ry="150" fill="#ffcf73" opacity="0.18" filter="url(#glow)" style={{ mixBlendMode: "screen" }} />}
      <rect width={W} height={H} fill="url(#r-vignette)" pointerEvents="none" />
    </g>
  );
}

// ---------------- Bureau du coach ----------------
function Office({ tod, s, info }: Ctx) {
  const night = tod === "night";
  const ty = FL(0.5, 0.32)[1] - 150 * scaleAt(0.32);
  return (
    <g>
      <Shell wall="#d9dde2" wallDark="#a9b0b8" floor="#8a7a69" floorDark="#3f362d" ceil="#e5e7ea" night={night} />
      <Planks opacity={0.12} />
      {/* grande fenêtre sur la ville */}
      <g>
        <rect x="462" y="232" width="380" height="330" fill="#20242c" />
        <Sky x={472} y={242} w={360} h={310} tod={tod} kind="city" />
        <rect x="648" y="242" width="8" height="310" fill="#20242c" />
        <rect x="472" y="242" width="360" height="310" fill="url(#glass2)" />
        <defs><linearGradient id="glass2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.14" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        <rect x="452" y="560" width="400" height="14" fill="#c4c9cf" />
      </g>
      <LightShaft x={472} y={242} w={360} h={310} tod={tod} />
      {/* calendrier → emploi du temps */}
      <Hot spot={s.calendar} tx={935} ty={232}>
        <g filter="url(#shadow)">
          <rect x="878" y="250" width="114" height="140" rx="4" fill="#fafafa" />
          <rect x="878" y="250" width="114" height="30" rx="4" fill="#dc2626" />
          <text x="935" y="271" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">{info.month}</text>
          {Array.from({ length: 20 }, (_, i) => <rect key={i} x={886 + (i % 5) * 20.5} y={288 + Math.floor(i / 5) * 24} width="16" height="18" rx="2" fill={i === 7 ? "#fbbf24" : "#e5e7eb"} />)}
        </g>
      </Hot>
      {/* tableau de liège → to-do */}
      <Hot spot={s.board} tx={1085} ty={232}>
        <g filter="url(#shadow)">
          <rect x="1010" y="248" width="156" height="200" rx="5" fill="#8a5a2b" />
          <rect x="1018" y="256" width="140" height="184" fill="#c99a63" />
          {Array.from({ length: 6 }, (_, i) => { const x = 1026 + (i % 2) * 66, y = 266 + Math.floor(i / 2) * 58; return <g key={i} transform={`rotate(${(hash(i + 4) - 0.5) * 10} ${x + 28} ${y + 26})`}><rect x={x} y={y} width="56" height="50" fill={["#fde047", "#f9a8d4", "#86efac", "#93c5fd", "#fde047", "#fdba74"][i]} /><rect x={x + 8} y={y + 16} width="38" height="3" fill="#0003" /><rect x={x + 8} y={y + 26} width="30" height="3" fill="#0003" /><circle cx={x + 28} cy={y + 5} r="4" fill="#dc2626" /></g>; })}
        </g>
      </Hot>
      {/* tableau blanc → notes (mur droit) */}
      <Hot spot={s.whiteboard} tx={RW(0.42, 0.86)[0]} ty={RW(0.42, 0.86)[1]}>
        <g>
          <polygon points={poly(RW(0.18, 0.36), RW(0.66, 0.36), RW(0.66, 0.8), RW(0.18, 0.8))} fill="#9ca3af" />
          <polygon points={poly(RW(0.2, 0.38), RW(0.64, 0.38), RW(0.64, 0.78), RW(0.2, 0.78))} fill="#fbfbfb" />
          <polyline points={[[0.6, 0.45], [0.53, 0.5], [0.46, 0.47], [0.39, 0.56], [0.32, 0.6], [0.24, 0.68]].map(([u, v]) => pt(RW(u, v))).join(" ")} fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <text x={RW(0.42, 0.72)[0]} y={RW(0.42, 0.72)[1]} textAnchor="middle" fontSize="18" fontWeight="800" fill="#334155">{info.avg}</text>
        </g>
      </Hot>
      {/* maillot encadré (mur gauche) */}
      <g>
        <polygon points={poly(LW(0.4, 0.4), LW(0.7, 0.4), LW(0.7, 0.75), LW(0.4, 0.75))} fill="#1f2937" />
        <polygon points={poly(LW(0.43, 0.43), LW(0.67, 0.43), LW(0.67, 0.72), LW(0.43, 0.72))} fill="#f1f5f9" />
        <text x={LW(0.55, 0.55)[0]} y={LW(0.55, 0.55)[1]} textAnchor="middle" fontSize="40" fontWeight="900" fill="#16a34a">9</text>
      </g>
      {/* fauteuil derrière le bureau */}
      <FloorBox x0={0.44} x1={0.56} d0={0.4} d1={0.47} h={230} top="#1f2937" front="#111827" side="#0b1120" />
      {/* bureau */}
      <FloorBox x0={0.28} x1={0.72} d0={0.22} d1={0.38} h={150} top="#3b2a1f" front="#2a1d15" side="#1f160f" />
      <g>
          <polygon points={`760,${ty - 4} 940,${ty - 4} 925,${ty - 116} 775,${ty - 116}`} fill="#1f2937" />
          <polygon points={`768,${ty - 10} 932,${ty - 10} 919,${ty - 110} 781,${ty - 110}`} fill={night ? "#0f2f4f" : "#1e3a5f"} />
          <polyline points={`792,${ty - 36} 820,${ty - 52} 848,${ty - 46} 876,${ty - 70} 906,${ty - 82}`} fill="none" stroke="#34d399" strokeWidth="4" />
          <ellipse cx="850" cy={ty - 60} rx="120" ry="70" fill="#38bdf8" opacity={night ? 0.25 : 0.08} filter="url(#glow)" />
          <rect x="745" y={ty - 6} width="210" height="10" rx="4" fill="#9ca3af" />
      </g>
      <Hot spot={s.copies} tx={620} ty={ty - 70}>
        <g filter="url(#shadow)">
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={565 + i * 2} y={ty - 20 - i * 4} width="110" height="36" fill={i % 2 ? "#f8fafc" : "#eef2f7"} transform={`rotate(${-4 + i} 620 ${ty})`} />)}
          <text x="622" y={ty - 30} textAnchor="middle" fontSize="16" fontWeight="900" fill="#dc2626" transform={`rotate(-3 620 ${ty})`}>DS</text>
        </g>
      </Hot>
      <g>
        <rect x="990" y={ty - 46} width="34" height="40" rx="5" fill="#f8fafc" />
        <path d={`M1024 ${ty - 38} q16 4 0 20`} stroke="#f8fafc" strokeWidth="5" fill="none" />
      </g>
      <Lamp x={1080} y={ty - 70} on={tod !== "day"} shade="#1f2937" />
      <Plant x={1450} y={830} s={1.3} />
      {night && <rect width={W} height={H} fill="#0b1026" opacity="0.34" />}
      <rect width={W} height={H} fill="url(#r-vignette)" pointerEvents="none" />
    </g>
  );
}

const ROOMS: Record<RoomId, (c: Ctx) => ReactNode> = { hall: Hall, library: Library, office: Office };
export const ROOM_NAME: Record<RoomId, string> = { hall: "Hall du club", library: "Bibliothèque", office: "Bureau du coach" };

function useTod(): Tod {
  const [h, setH] = useState(() => new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setH(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);
  return h < 7 || h >= 20 ? "night" : h >= 17 ? "dusk" : "day";
}

/** Une pièce du club, interactive. `info` : petits textes affichés dans le décor (compte à rebours, mois, moyenne…). */
export function Room({ id, spots, info = {}, className = "" }: { id: RoomId; spots: RoomSpot[]; info?: Record<string, string>; className?: string }) {
  const club = useStore((s) => s.club);
  const tod = useTod();
  const s = Object.fromEntries(spots.map((x) => [x.key, x]));
  return (
    <div className={`room room-${id} ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={ROOM_NAME[id]}>
        {ROOMS[id]({ tod, s, a: club.colorA, b: club.colorB, info })}
      </svg>
    </div>
  );
}
