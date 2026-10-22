/**
 * Prépa City : la ville du club en vue isométrique.
 * - Les infrastructures du club (stade, centre d'entraînement, formation, recruteurs, sponsors) s'achètent avec le budget.
 * - La BU, la tour EDHEC et le parc poussent tout seuls avec le vrai travail (heures, progression EDHEC, série de jours).
 * Toucher un bâtiment ouvre sa fiche. Jour / nuit selon l'heure, voitures, nuages, joueurs à l'entraînement.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { totalWorkMinutes, useStore } from "../lib/store";
import { FACILITIES, MAX_FACILITY, facilityCost } from "../lib/game";
import { currentStreak } from "../lib/insights";
import type { EdhecState, FacilityKey } from "../lib/types";
import { fmtMoney } from "../lib/utils";

const N = 8;
const HW = 32; // demi-largeur d'une case
const HH = 16; // demi-hauteur d'une case
const X0 = N * HW + 8;
const Y0 = 84; // place pour les tours et projecteurs au-dessus de la première rangée
const P = (gx: number, gy: number, z = 0) => [X0 + (gx - gy) * HW, Y0 + (gx + gy) * HH - z] as const;
const pts = (...ps: Array<readonly [number, number]>) => ps.map((p) => p.join(",")).join(" ");

/** Petit générateur déterministe, pour que les fenêtres allumées ne clignotent pas à chaque rendu. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

type Palette = { top: string; left: string; right: string };
const shade = (top: string, left: string, right: string): Palette => ({ top, left, right });

function Box({ gx, gy, w, d, h, z = 0, c, windows, night, seed = 1 }: {
  gx: number; gy: number; w: number; d: number; h: number; z?: number; c: Palette; windows?: { floors: number; cols: number; color?: string }; night: boolean; seed?: number;
}) {
  const A = (zz: number) => P(gx, gy, zz), B = (zz: number) => P(gx + w, gy, zz), C = (zz: number) => P(gx + w, gy + d, zz), D = (zz: number) => P(gx, gy + d, zz);
  const t = z + h;
  const win: ReactNode[] = [];
  if (windows && h > 6) {
    const fh = (h - 4) / windows.floors;
    for (let f = 0; f < windows.floors; f++) {
      const z1 = z + 3 + f * fh + fh * 0.25, z2 = z + 3 + f * fh + fh * 0.8;
      // façade gauche (le long de x, en y = gy + d)
      const nl = Math.max(1, Math.round(windows.cols * w));
      for (let i = 0; i < nl; i++) {
        const u1 = gx + (i + 0.2) * (w / nl), u2 = gx + (i + 0.8) * (w / nl);
        const lit = night ? hash(seed * 97 + f * 13 + i) > 0.35 : false;
        win.push(<polygon key={`l${f}-${i}`} points={pts(P(u1, gy + d, z1), P(u2, gy + d, z1), P(u2, gy + d, z2), P(u1, gy + d, z2))} fill={lit ? "#fde68a" : windows.color ?? "#bfdbfe"} opacity={lit ? 0.95 : 0.55} />);
      }
      // façade droite (le long de y, en x = gx + w)
      const nr = Math.max(1, Math.round(windows.cols * d));
      for (let i = 0; i < nr; i++) {
        const v1 = gy + d - (i + 0.2) * (d / nr), v2 = gy + d - (i + 0.8) * (d / nr);
        const lit = night ? hash(seed * 61 + f * 7 + i + 50) > 0.4 : false;
        win.push(<polygon key={`r${f}-${i}`} points={pts(P(gx + w, v1, z1), P(gx + w, v2, z1), P(gx + w, v2, z2), P(gx + w, v1, z2))} fill={lit ? "#fcd34d" : windows.color ?? "#93c5fd"} opacity={lit ? 0.9 : 0.4} />);
      }
    }
  }
  return (
    <g>
      <polygon points={pts(D(t), C(t), C(z), D(z))} fill={c.left} />
      <polygon points={pts(C(t), B(t), B(z), C(z))} fill={c.right} />
      <polygon points={pts(A(t), B(t), C(t), D(t))} fill={c.top} />
      {win}
    </g>
  );
}

/** Case plate (sol, terrain, route). */
const Tile = ({ gx, gy, w = 1, d = 1, z = 0, fill, stroke, children }: { gx: number; gy: number; w?: number; d?: number; z?: number; fill: string; stroke?: string; children?: ReactNode }) => (
  <g>
    <polygon points={pts(P(gx, gy, z), P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx, gy + d, z))} fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
    {children}
  </g>
);

function Pitch({ gx, gy, w, d, z = 0.5, players }: { gx: number; gy: number; w: number; d: number; z?: number; players?: number }) {
  const inset = 0.15;
  return (
    <g>
      <Tile gx={gx} gy={gy} w={w} d={d} z={z} fill="#16a34a" />
      <polygon points={pts(P(gx + inset, gy + inset, z), P(gx + w - inset, gy + inset, z), P(gx + w - inset, gy + d - inset, z), P(gx + inset, gy + d - inset, z))} fill="#22c55e" stroke="#ffffffaa" strokeWidth="1" />
      <line x1={P(gx + w / 2, gy + inset, z)[0]} y1={P(gx + w / 2, gy + inset, z)[1]} x2={P(gx + w / 2, gy + d - inset, z)[0]} y2={P(gx + w / 2, gy + d - inset, z)[1]} stroke="#ffffffaa" strokeWidth="1" />
      {Array.from({ length: players ?? 0 }, (_, i) => {
        const [x, y] = P(gx + 0.4 + hash(i + 3) * (w - 0.8), gy + 0.4 + hash(i + 9) * (d - 0.8), z);
        return <circle key={i} className={`runner r${i % 3}`} cx={x} cy={y - 2} r="2.2" fill={i % 2 ? "#fde047" : "#f8fafc"} />;
      })}
    </g>
  );
}

function Lot({ gx, gy, w, d, label }: { gx: number; gy: number; w: number; d: number; label: string }) {
  const [cx, cy] = P(gx + w / 2, gy + d / 2);
  return (
    <g>
      <Tile gx={gx} gy={gy} w={w} d={d} fill="#a16207" />
      <polygon points={pts(P(gx + 0.1, gy + 0.1), P(gx + w - 0.1, gy + 0.1), P(gx + w - 0.1, gy + d - 0.1), P(gx + 0.1, gy + d - 0.1))} fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="4 3" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13">🚧</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7" fill="#fef3c7" fontWeight="700">{label}</text>
    </g>
  );
}

function Tree({ gx, gy, s = 1 }: { gx: number; gy: number; s?: number }) {
  const [x, y] = P(gx, gy);
  return (
    <g className="sway">
      <rect x={x - 1} y={y - 7 * s} width="2" height={7 * s} fill="#78350f" />
      <circle cx={x} cy={y - 10 * s} r={5.5 * s} fill="#15803d" />
      <circle cx={x - 2 * s} cy={y - 12 * s} r={3 * s} fill="#22c55e" />
    </g>
  );
}

// ---------------- Bâtiments ----------------

type BuildingId = FacilityKey | "bu" | "edhec" | "park";
type Ctx = { night: boolean; lvl: Record<FacilityKey, number>; bu: number; edhecFloors: number; trees: number };

const BUILDINGS: Array<{ id: BuildingId; gx: number; gy: number; w: number; d: number; draw: (c: Ctx) => ReactNode }> = [
  {
    id: "stadium", gx: 0, gy: 0, w: 3, d: 3,
    draw: ({ lvl, night }) => {
      const l = lvl.stadium;
      if (!l) return <Lot gx={0} gy={0} w={3} d={3} label="Stade" />;
      const h = 6 + 5 * l;
      const stand = shade("#e2e8f0", "#94a3b8", "#64748b");
      return (
        <g>
          <Box gx={0} gy={0} w={3} d={0.55} h={h} c={stand} night={night} />
          <Box gx={0} gy={0.55} w={0.55} d={2.45} h={h} c={stand} night={night} />
          <Pitch gx={0.55} gy={0.55} w={2.45} d={2.45} z={1} players={l >= 2 ? 6 : 0} />
          {l >= 3 && [[0, 0], [3, 0], [0, 3]].map(([a, b], i) => {
            const [x, y] = P(a, b);
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={x} y2={y - h - 26} stroke="#cbd5e1" strokeWidth="1.5" />
                <rect x={x - 4} y={y - h - 30} width="8" height="5" fill={night ? "#fef9c3" : "#e2e8f0"} className={night ? "glow" : ""} />
              </g>
            );
          })}
          <Box gx={0.55} gy={2.7} w={2.45} d={0.3} h={Math.max(4, h * 0.35)} c={shade("#cbd5e1", "#94a3b8", "#64748b")} night={night} />
          <Box gx={2.7} gy={0.55} w={0.3} d={2.15} h={Math.max(4, h * 0.35)} c={shade("#cbd5e1", "#94a3b8", "#64748b")} night={night} />
          {l >= 5 && <polygon points={pts(P(0, 0, h + 8), P(3, 0, h + 8), P(3, 0.9, h + 8), P(0.9, 0.9, h + 8), P(0.9, 3, h + 8), P(0, 3, h + 8))} fill="#ffffff55" stroke="#fff" strokeWidth="0.8" />}
        </g>
      );
    },
  },
  {
    id: "training", gx: 4, gy: 0, w: 4, d: 3,
    draw: ({ lvl, night }) => {
      const l = lvl.training;
      if (!l) return <Lot gx={4} gy={0} w={4} d={3} label="Centre d'entraînement" />;
      return (
        <g>
          <Tile gx={4} gy={0} w={4} d={3} fill="#4d7c0f" />
          <Pitch gx={4.1} gy={0.1} w={2.8} d={l >= 4 ? 1.7 : 2.8} players={2 + l * 2} />
          {l >= 4 && <Pitch gx={4.1} gy={1.9} w={2.8} d={1} players={4} />}
          {l >= 2 && <Box gx={7.05} gy={0.1} w={0.85} d={2.8} h={8 + 6 * (l - 1)} c={shade("#fca5a5", "#ef4444", "#b91c1c")} windows={{ floors: l - 1, cols: 1.4 }} night={night} seed={11} />}
        </g>
      );
    },
  },
  {
    id: "academy", gx: 0, gy: 4, w: 2, d: 2,
    draw: ({ lvl, night }) => {
      const l = lvl.academy;
      if (!l) return <Lot gx={0} gy={4} w={2} d={2} label="Formation" />;
      const h = 12 * l + 6;
      const [fx, fy] = P(1, 5, h);
      return (
        <g>
          <Tile gx={0} gy={4} w={2} d={2} fill="#65a30d" />
          <Box gx={0.2} gy={4.2} w={1.6} d={1.6} h={h} c={shade("#fdba74", "#ea580c", "#c2410c")} windows={{ floors: l, cols: 2 }} night={night} seed={23} />
          <line x1={fx} y1={fy} x2={fx} y2={fy - 16} stroke="#e5e7eb" strokeWidth="1" />
          <polygon className="flag" points={`${fx},${fy - 16} ${fx + 10},${fy - 13} ${fx},${fy - 10}`} fill="#22c55e" />
        </g>
      );
    },
  },
  {
    id: "park", gx: 0, gy: 6, w: 3, d: 2,
    draw: ({ trees }) => (
      <g>
        <Tile gx={0} gy={6} w={3} d={2} fill="#4ade80" />
        <ellipse cx={P(1.5, 7)[0]} cy={P(1.5, 7)[1]} rx="12" ry="6" fill="#38bdf8" stroke="#e0f2fe" />
        <circle cx={P(1.5, 7)[0]} cy={P(1.5, 7)[1] - 3} r="1.6" fill="#e0f2fe" className="fountain" />
        {Array.from({ length: trees }, (_, i) => <Tree key={i} gx={0.3 + hash(i + 40) * 2.4} gy={6.25 + hash(i + 77) * 1.5} s={0.8 + hash(i) * 0.4} />)}
      </g>
    ),
  },
  {
    id: "bu", gx: 4, gy: 4, w: 2, d: 2,
    draw: ({ bu, night }) => {
      if (!bu) return <Lot gx={4} gy={4} w={2} d={2} label="BU (5 h de travail)" />;
      const h = 10 + 10 * bu;
      return (
        <g>
          <Tile gx={4} gy={4} w={2} d={2} fill="#d6d3d1" />
          <Box gx={4.15} gy={4.15} w={1.7} d={1.7} h={h} c={shade("#fef3c7", "#d6b88a", "#b08d5b")} windows={{ floors: bu, cols: 2.4, color: "#fde68a" }} night={night} seed={31} />
          <Box gx={4.05} gy={4.05} w={1.9} d={1.9} h={2} z={h} c={shade("#e7e5e4", "#a8a29e", "#78716c")} night={night} />
        </g>
      );
    },
  },
  {
    id: "scouting", gx: 6, gy: 4, w: 1, d: 1,
    draw: ({ lvl, night }) => {
      const l = lvl.scouting;
      if (!l) return <Lot gx={6} gy={4} w={1} d={1} label="Recruteurs" />;
      const h = 16 + 12 * l;
      const [x, y] = P(6.5, 4.5, h + 3);
      return (
        <g>
          <Box gx={6.2} gy={4.2} w={0.6} d={0.6} h={h} c={shade("#c4b5fd", "#8b5cf6", "#6d28d9")} windows={{ floors: Math.max(1, l * 2), cols: 1.5 }} night={night} seed={41} />
          <line x1={x} y1={y} x2={x} y2={y - 14} stroke="#e5e7eb" strokeWidth="1.2" />
          <circle cx={x} cy={y - 15} r="2" fill="#ef4444" className="blink" />
          {l >= 3 && <ellipse cx={x + 6} cy={y - 4} rx="5" ry="2.5" fill="#e5e7eb" transform={`rotate(-30 ${x + 6} ${y - 4})`} className="dish" />}
        </g>
      );
    },
  },
  {
    id: "staff", gx: 7, gy: 4, w: 1, d: 1,
    draw: ({ lvl, night }) => {
      const l = lvl.staff;
      if (!l) return <Lot gx={7} gy={4} w={1} d={1} label="Sponsors" />;
      const h = 22 + 16 * l;
      const [x, y] = P(7.5, 5, h);
      return (
        <g>
          <Box gx={7.1} gy={4.1} w={0.8} d={0.8} h={h} c={shade("#7dd3fc", "#0284c7", "#075985")} windows={{ floors: l * 2 + 1, cols: 2, color: "#e0f2fe" }} night={night} seed={53} />
          <text x={x} y={y - 4} textAnchor="middle" fontSize="7" fontWeight="900" fill="#fde047">€</text>
        </g>
      );
    },
  },
  {
    id: "edhec", gx: 6, gy: 6, w: 2, d: 2,
    draw: ({ edhecFloors, night }) => {
      const h = 8 + 9 * edhecFloors;
      const done = edhecFloors >= 12;
      const [x, y] = P(7, 7, h + 2);
      return (
        <g>
          <Tile gx={6} gy={6} w={2} d={2} fill="#cbd5e1" />
          <Box gx={6.3} gy={6.3} w={1.4} d={1.4} h={h} c={shade("#fde68a", "#d97706", "#92400e")} windows={{ floors: edhecFloors, cols: 2, color: "#fef3c7" }} night={night} seed={67} />
          {done ? <text x={x} y={y - 2} textAnchor="middle" fontSize="14">👑</text> : <g className="crane"><line x1={x} y1={y} x2={x} y2={y - 22} stroke="#facc15" strokeWidth="1.5" /><line x1={x - 14} y1={y - 22} x2={x + 10} y2={y - 22} stroke="#facc15" strokeWidth="1.5" /></g>}
        </g>
      );
    },
  },
];

const ROADS = (() => {
  const r: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    r.push([3, i]);
    if (i !== 3) r.push([i, 3]);
  }
  return r;
})();

// ---------------- Fiches ----------------

const STUDY_INFO: Record<"bu" | "edhec" | "park", { label: string; icon: string }> = {
  bu: { label: "Bibliothèque universitaire", icon: "📚" },
  edhec: { label: "Tour EDHEC", icon: "🎯" },
  park: { label: "Parc de la série", icon: "🌳" },
};
const BU_STEPS = [5, 15, 35, 70, 120, 200, 300];
const buLevel = (hours: number) => BU_STEPS.filter((s) => hours >= s).length;

export function edhecProgress(e: EdhecState) {
  const ch = e.chapters.length ? e.chapters.reduce((a, c) => a + c.level, 0) / (3 * e.chapters.length) : 0;
  const an = Math.min(1, e.annales.filter((a) => a.done).length / 20);
  const sy = Math.min(1, e.syntheses.length / 15);
  return 0.5 * ch + 0.3 * an + 0.2 * sy;
}

export function useCityStats() {
  const sessions = useStore((s) => s.sessions);
  const edhec = useStore((s) => s.edhec);
  const facilities = useStore((s) => s.club.facilities);
  return useMemo(() => {
    const hours = totalWorkMinutes(sessions) / 60;
    const streak = currentStreak(sessions);
    const p = edhecProgress(edhec);
    return { hours, streak, p, bu: buLevel(hours), edhecFloors: 1 + Math.round(p * 11), trees: Math.min(14, 2 + streak), lvl: facilities };
  }, [sessions, edhec, facilities]);
}

export function City({ compact, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const coins = useStore((s) => s.coins);
  const upgrade = useStore((s) => s.upgradeFacility);
  const stats = useCityStats();
  const [sel, setSel] = useState<BuildingId | null>(null);
  const [risen, setRisen] = useState<BuildingId | null>(null);
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(id);
  }, []);
  const night = hour < 7 || hour >= 20;
  const dusk = hour >= 18 && hour < 20;
  const prev = useRef(stats);
  useEffect(() => {
    // Un étage de plus : petite animation de construction
    const p = prev.current;
    const grown = (Object.keys(stats.lvl) as FacilityKey[]).find((k) => stats.lvl[k] > p.lvl[k]) ?? (stats.bu > p.bu ? "bu" : stats.edhecFloors > p.edhecFloors ? "edhec" : null);
    if (grown) {
      setRisen(grown);
      const t = setTimeout(() => setRisen(null), 1400);
      prev.current = stats;
      return () => clearTimeout(t);
    }
    prev.current = stats;
  }, [stats]);

  const ctx: Ctx = { night, lvl: stats.lvl, bu: stats.bu, edhecFloors: stats.edhecFloors, trees: stats.trees };
  const order = [...BUILDINGS].sort((a, b) => a.gx + a.gy + a.w + a.d - (b.gx + b.gy + b.w + b.d) || a.gx - b.gx);
  const W = X0 * 2, H = Y0 + N * HH * 2 + 10;
  const sky = night ? ["#0b1026", "#1e1b4b"] : dusk ? ["#fb923c", "#7c3aed"] : ["#7dd3fc", "#e0f2fe"];
  const selB = BUILDINGS.find((b) => b.id === sel);

  return (
    <div className={`city ${compact ? "compact" : ""}`}>
      <svg viewBox={compact ? `0 ${Y0 - 30} ${W} ${H - Y0 + 30}` : `0 0 ${W} ${H}`} className="city-svg" role="img" aria-label="Prépa City" onClick={compact ? onOpen : undefined}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky[0]} />
            <stop offset="1" stopColor={sky[1]} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#sky)" />
        {night && Array.from({ length: 30 }, (_, i) => <circle key={i} cx={hash(i) * W} cy={hash(i + 99) * 160} r={hash(i + 5) * 1.2 + 0.3} fill="#fff" className={i % 4 ? "" : "blink"} />)}
        {!night && (
          <g opacity="0.85">
            <g className="cloud c1"><ellipse cx="80" cy="30" rx="26" ry="9" fill="#fff" /><ellipse cx="96" cy="24" rx="16" ry="9" fill="#fff" /></g>
            <g className="cloud c2"><ellipse cx="380" cy="120" rx="30" ry="10" fill="#fff" /><ellipse cx="362" cy="114" rx="14" ry="8" fill="#fff" /></g>
          </g>
        )}
        {/* socle */}
        <polygon points={pts(P(0, 0), P(N, 0), P(N, N), P(0, N))} fill={night ? "#14532d" : "#4ade80"} />
        <polygon points={pts(P(0, N), P(N, N), P(N, N, -10), P(0, N, -10))} fill={night ? "#3f2a14" : "#92400e"} />
        <polygon points={pts(P(N, 0), P(N, N), P(N, N, -10), P(N, 0, -10))} fill={night ? "#2a1c0e" : "#78350f"} />
        {ROADS.map(([gx, gy]) => (
          <Tile key={`${gx}-${gy}`} gx={gx} gy={gy} fill={night ? "#334155" : "#64748b"}>
            {gx === 3 && gy !== 3 && <line x1={P(3.5, gy + 0.15)[0]} y1={P(3.5, gy + 0.15)[1]} x2={P(3.5, gy + 0.85)[0]} y2={P(3.5, gy + 0.85)[1]} stroke="#fde68a" strokeWidth="1" strokeDasharray="3 3" />}
            {gy === 3 && gx !== 3 && <line x1={P(gx + 0.15, 3.5)[0]} y1={P(gx + 0.15, 3.5)[1]} x2={P(gx + 0.85, 3.5)[0]} y2={P(gx + 0.85, 3.5)[1]} stroke="#fde68a" strokeWidth="1" strokeDasharray="3 3" />}
          </Tile>
        ))}
        {/* voitures */}
        {[0, 1].map((i) => (
          <g key={i}>
            <rect x="-4" y="-3" width="8" height="5" rx="1.5" fill={i ? "#f43f5e" : "#facc15"}>
              <animateMotion dur={`${9 + i * 4}s`} repeatCount="indefinite" path={i ? `M${P(0.05, 3.3).join(",")} L${P(N - 0.05, 3.3).join(",")}` : `M${P(3.7, N - 0.05).join(",")} L${P(3.7, 0.05).join(",")}`} />
            </rect>
            {night && <circle r="2" fill="#fef9c3" opacity="0.8"><animateMotion dur={`${9 + i * 4}s`} repeatCount="indefinite" path={i ? `M${P(0.05, 3.3).join(",")} L${P(N - 0.05, 3.3).join(",")}` : `M${P(3.7, N - 0.05).join(",")} L${P(3.7, 0.05).join(",")}`} /></circle>}
          </g>
        ))}
        {/* petites maisons décoratives */}
        <Box gx={2.2} gy={4.2} w={0.6} d={0.6} h={10} c={shade("#fecaca", "#f87171", "#dc2626")} windows={{ floors: 1, cols: 1.4 }} night={night} seed={3} />
        <Box gx={2.2} gy={5.2} w={0.6} d={0.6} h={8} c={shade("#bbf7d0", "#4ade80", "#16a34a")} windows={{ floors: 1, cols: 1.4 }} night={night} seed={4} />
        <Tree gx={6.5} gy={5.6} />
        <Tree gx={7.5} gy={5.5} s={0.8} />
        <Tile gx={4} gy={6} w={2} d={2} fill="#e7e5e4" />
        <Tree gx={4.4} gy={6.6} s={0.9} />
        <Tree gx={5.5} gy={7.5} s={0.9} />
        {order.map((b) => (
          <g
            key={b.id}
            className={`bld ${sel === b.id ? "sel" : ""} ${risen === b.id ? "rise" : ""}`}
            onClick={compact ? undefined : (e) => { e.stopPropagation(); setSel(sel === b.id ? null : b.id); }}
          >
            {b.draw(ctx)}
            {sel === b.id && <polygon points={pts(P(b.gx, b.gy), P(b.gx + b.w, b.gy), P(b.gx + b.w, b.gy + b.d), P(b.gx, b.gy + b.d))} fill="none" stroke="#fff" strokeWidth="2" className="pulse" />}
          </g>
        ))}
      </svg>
      {!compact && (
        <div className="city-panel">
          {selB ? <BuildingCard id={selB.id} coins={coins} stats={stats} onUpgrade={(k) => upgrade(k)} /> : <div className="small muted">Touche un bâtiment pour l'ouvrir. La BU, la tour EDHEC et le parc poussent avec ton vrai travail ; le reste s'achète avec le budget du club.</div>}
        </div>
      )}
    </div>
  );
}

function BuildingCard({ id, coins, stats, onUpgrade }: { id: BuildingId; coins: number; stats: ReturnType<typeof useCityStats>; onUpgrade: (k: FacilityKey) => void }) {
  if (id === "bu" || id === "edhec" || id === "park") {
    const info = STUDY_INFO[id];
    const body =
      id === "bu"
        ? (() => {
            const next = BU_STEPS[stats.bu];
            return <>Un étage par palier d'heures de travail. <b>{stats.hours.toFixed(1)} h</b> au compteur{next ? ` · prochain étage à ${next} h (encore ${(next - stats.hours).toFixed(1)} h)` : " · BU complète !"}.</>;
          })()
        : id === "edhec"
          ? <>Monte avec ta préparation : chapitres de micro maîtrisés (50 %), annales faites (30 %), synthèses (20 %). Progression <b>{Math.round(stats.p * 100)} %</b> · {stats.edhecFloors}/12 étages. Couronne à 100 %.</>
          : <>Un arbre par jour de série. Série actuelle : <b>{stats.streak} j</b>. Un jour sans au moins 25 min de travail et la série retombe.</>;
    return (
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
        <span style={{ fontSize: 26 }}>{info.icon}</span>
        <div><b>{info.label}</b><div className="small muted">{body}</div></div>
      </div>
    );
  }
  const f = FACILITIES[id];
  const l = stats.lvl[id];
  const max = l >= MAX_FACILITY;
  const cost = facilityCost(id, l);
  return (
    <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <span style={{ fontSize: 26 }}>{f.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between"><b>{f.label}</b><span className="stars">{"★".repeat(l)}<span style={{ opacity: 0.25 }}>{"★".repeat(MAX_FACILITY - l)}</span></span></div>
        <div className="small muted">{f.desc(l)}</div>
        {!max && <div className="small">Niveau {l + 1} : <span className="muted">{f.desc(l + 1)}</span></div>}
        <button className={`btn sm ${coins >= cost && !max ? "gold" : ""}`} style={{ marginTop: 8 }} disabled={max || coins < cost} onClick={() => onUpgrade(id)}>
          {max ? "Niveau max" : l === 0 ? `Construire · ${fmtMoney(cost)}` : `Agrandir · ${fmtMoney(cost)}`}
        </button>
        {!max && coins < cost && <span className="small muted"> · encore {fmtMoney(cost - coins)} : ~{Math.ceil((cost - coins) / 10)} min de travail</span>}
      </div>
    </div>
  );
}
