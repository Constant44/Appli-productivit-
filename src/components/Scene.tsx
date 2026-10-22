/**
 * Décors du club : chaque rubrique est une pièce (hall, bureau du coach, bibliothèque, vestiaire, bureau du président,
 * tunnel, salle des trophées). Les objets du décor sont cliquables et mènent à l'écran correspondant.
 * Rendu « hologramme » : tracés lumineux sur fond sombre. Changer de pièce fait passer par le couloir.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../lib/store";

export type SceneId = "lobby" | "coach" | "library" | "locker" | "president" | "tunnel" | "trophies" | "corridor";

export type Hotspot = { id: string; label: string; onClick: () => void; active?: boolean };

const SCENE_NAME: Record<SceneId, string> = {
  lobby: "Hall du club",
  coach: "Bureau du coach",
  library: "Bibliothèque",
  locker: "Vestiaire",
  president: "Bureau du président",
  tunnel: "Tunnel des joueurs",
  trophies: "Salle des trophées",
  corridor: "Couloir",
};

const hash = (n: number) => {
  const x = Math.sin(n * 91.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------- Mobilier ----------------

function Win({ x, y, w, h, night, view = "stadium" }: { x: number; y: number; w: number; h: number; night: boolean; view?: "stadium" | "city" | "pitch" }) {
  const sky = night ? ["#0b1026", "#312e81"] : ["#7dd3fc", "#e0f2fe"];
  const id = `win-${x}-${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
        <clipPath id={`${id}-c`}><rect x={x} y={y} width={w} height={h} /></clipPath>
      </defs>
      <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx="6" fill="#0f172a" />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}-c)`}>
        {night && Array.from({ length: 14 }, (_, i) => <circle key={i} cx={x + hash(i + x) * w} cy={y + hash(i * 3 + y) * h * 0.5} r="1.2" fill="#fff" className={i % 3 ? "" : "blink"} />)}
        {!night && <g className="cloud c1"><ellipse cx={x + w * 0.2} cy={y + h * 0.22} rx="26" ry="8" fill="#fff" opacity="0.9" /></g>}
        {view === "stadium" && (
          <g>
            <path d={`M${x} ${y + h} L${x} ${y + h * 0.62} Q${x + w / 2} ${y + h * 0.42} ${x + w} ${y + h * 0.62} L${x + w} ${y + h} Z`} fill={night ? "#334155" : "#cbd5e1"} />
            <path d={`M${x + w * 0.08} ${y + h} Q${x + w / 2} ${y + h * 0.66} ${x + w * 0.92} ${y + h} Z`} fill="#22c55e" />
            {[0.15, 0.85].map((f, i) => (
              <g key={i}>
                <line x1={x + w * f} y1={y + h * 0.62} x2={x + w * f} y2={y + h * 0.2} stroke="#94a3b8" strokeWidth="2" />
                <rect x={x + w * f - 7} y={y + h * 0.17} width="14" height="7" fill={night ? "#fef9c3" : "#e2e8f0"} className={night ? "glow" : ""} />
              </g>
            ))}
          </g>
        )}
        {view === "city" && Array.from({ length: 9 }, (_, i) => {
          const bw = w / 9, bh = h * (0.25 + hash(i + 7) * 0.45);
          return (
            <g key={i}>
              <rect x={x + i * bw} y={y + h - bh} width={bw - 3} height={bh} fill={night ? "#1e293b" : "#94a3b8"} />
              {night && Array.from({ length: 4 }, (_, j) => <rect key={j} x={x + i * bw + 4 + (j % 2) * 8} y={y + h - bh + 6 + Math.floor(j / 2) * 10} width="4" height="5" fill="#fde68a" opacity={hash(i * 4 + j) > 0.4 ? 0.9 : 0.1} />)}
            </g>
          );
        })}
        {view === "pitch" && <rect x={x} y={y + h * 0.6} width={w} height={h * 0.4} fill="#16a34a" />}
      </g>
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#0f172a" strokeWidth="5" />
      <line x1={x} y1={y + h * 0.45} x2={x + w} y2={y + h * 0.45} stroke="#0f172a" strokeWidth="4" />
    </g>
  );
}

const Plant = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className="sway">
    <path d="M-14 0 L14 0 L10 26 L-10 26 Z" fill="#b45309" />
    {[-30, -12, 8, 26].map((a, i) => <ellipse key={i} cx={a * 0.5} cy={-22 - (i % 2) * 10} rx="8" ry="22" fill={i % 2 ? "#16a34a" : "#22c55e"} transform={`rotate(${a} 0 0)`} />)}
  </g>
);

function Shelf({ x, y, w, rows = 3, seed = 1 }: { x: number; y: number; w: number; rows?: number; seed?: number }) {
  const cols = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6"];
  return (
    <g>
      <rect x={x} y={y} width={w} height={rows * 46 + 12} fill="#78350f" rx="4" />
      {Array.from({ length: rows }, (_, r) => {
        let cx = x + 8;
        const books: ReactNode[] = [];
        let i = 0;
        while (cx < x + w - 14) {
          const bw = 8 + hash(seed * 31 + r * 7 + i) * 9;
          const bh = 28 + hash(seed * 17 + r * 3 + i) * 12;
          books.push(<rect key={i} x={cx} y={y + 8 + r * 46 + (40 - bh)} width={bw} height={bh} fill={cols[Math.floor(hash(seed + r * 11 + i * 5) * cols.length)]} rx="1.5" />);
          cx += bw + 2;
          i++;
        }
        return (
          <g key={r}>
            <rect x={x + 4} y={y + 6 + r * 46} width={w - 8} height="42" fill="#451a03" />
            {books}
            <rect x={x} y={y + 48 + r * 46} width={w} height="6" fill="#92400e" />
          </g>
        );
      })}
    </g>
  );
}

const Desk = ({ x, y, w, color = "#92400e" }: { x: number; y: number; w: number; color?: string }) => (
  <g>
    <rect x={x} y={y} width={w} height="16" rx="3" fill={color} />
    <rect x={x + 10} y={y + 16} width={w - 20} height="70" fill={color} opacity="0.85" />
    <rect x={x + 10} y={y + 16} width={w - 20} height="70" fill="#000" opacity="0.18" />
  </g>
);

const Lamp = ({ x, y, on }: { x: number; y: number; on: boolean }) => (
  <g>
    {on && <ellipse cx={x + 18} cy={y + 46} rx="44" ry="10" fill="#fde68a" opacity="0.25" />}
    <rect x={x - 6} y={y + 40} width="20" height="5" rx="2" fill="#334155" />
    <line x1={x + 4} y1={y + 40} x2={x + 10} y2={y + 6} stroke="#334155" strokeWidth="3" />
    <path d={`M${x} ${y + 12} L${x + 28} ${y} L${x + 34} ${y + 16} Z`} fill="#0ea5e9" />
  </g>
);

const Crest = ({ x, y, s = 1, a, b }: { x: number; y: number; s?: number; a: string; b: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 -26 L22 -19 V-2 C22 12 11 20 0 24 C-11 20 -22 12 -22 -2 V-19 Z" fill={b} stroke={a} strokeWidth="3" />
    <path d="M0 -19 V18" stroke={a} strokeWidth="7" />
    <circle cx="0" cy="-2" r="6" fill="#fff" />
  </g>
);

const Trophy = ({ x, y, s = 1, c = "#fbbf24" }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-14 -40 H14 V-28 C14 -16 6 -10 0 -10 C-6 -10 -14 -16 -14 -28 Z" fill={c} />
    <path d="M-14 -36 C-24 -36 -24 -22 -12 -20 M14 -36 C24 -36 24 -22 12 -20" stroke={c} strokeWidth="3" fill="none" />
    <rect x="-3" y="-10" width="6" height="8" fill={c} />
    <rect x="-10" y="-2" width="20" height="6" rx="1" fill="#78350f" />
    <rect x="-4" y="-36" width="3" height="14" fill="#fff" opacity="0.4" />
  </g>
);

const Door = ({ x, y, label, color = "#475569" }: { x: number; y: number; label?: string; color?: string }) => (
  <g>
    <rect x={x} y={y} width="70" height="150" rx="3" fill={color} />
    <rect x={x + 8} y={y + 10} width="54" height="56" rx="2" fill="#000" opacity="0.15" />
    <rect x={x + 8} y={y + 76} width="54" height="64" rx="2" fill="#000" opacity="0.15" />
    <circle cx={x + 58} cy={y + 82} r="4" fill="#fbbf24" />
    {label && <><rect x={x + 6} y={y - 22} width="58" height="16" rx="3" fill="#0f172a" /><text x={x + 35} y={y - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e2e8f0">{label}</text></>}
  </g>
);

const Floor = ({ y, color = "#7c2d12", boards = true }: { y: number; color?: string; boards?: boolean }) => (
  <g>
    <rect x="0" y={y} width="1200" height={300 - y} fill={color} />
    {boards && Array.from({ length: 13 }, (_, i) => <line key={i} x1={i * 100 - 40} y1={y} x2={i * 100 - 120} y2="300" stroke="#000" strokeOpacity="0.15" strokeWidth="2" />)}
    <rect x="0" y={y} width="1200" height="6" fill="#000" opacity="0.25" />
  </g>
);

/** Objet cliquable du décor : léger halo au survol, halo animé quand c'est l'écran courant. */
function Hot({ spot, children, lx, ly }: { spot?: Hotspot; children: ReactNode; lx: number; ly: number }) {
  if (!spot) return <>{children}</>;
  return (
    <g className={`hot ${spot.active ? "lit" : ""}`} role="button" tabIndex={0} aria-label={spot.label}
      onClick={spot.onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && spot.onClick()}>
      {children}
      <g className="hot-label" transform={`translate(${lx} ${ly})`}>
        <rect x={-spot.label.length * 3.6 - 10} y="-13" width={spot.label.length * 7.2 + 20} height="22" rx="11" fill="#0b1120ee" />
        <text textAnchor="middle" y="2" fontSize="12" fontWeight="700" fill="#f8fafc">{spot.label}</text>
      </g>
    </g>
  );
}

// ---------------- Pièces ----------------

type DrawCtx = { night: boolean; spots: Record<string, Hotspot>; a: string; b: string };

const SCENES: Record<SceneId, (c: DrawCtx) => ReactNode> = {
  lobby: ({ night, spots, a, b }) => (
    <g>
      <rect width="1200" height="300" fill="#1e293b" />
      <rect width="1200" height="300" fill="url(#wallgrad)" />
      <Hot spot={spots.window} lx={600} ly={40}><Win x={410} y={30} w={380} h={170} night={night} view="stadium" /></Hot>
      <Hot spot={spots.door} lx={255} ly={70}><Door x={220} y={92} label="VESTIAIRES" color="#334155" /></Hot>
      <Hot spot={spots.cabinet} lx={925} ly={60}>
        <g>
          <rect x="860" y="70" width="130" height="172" rx="4" fill="#0f172a" />
          <rect x="868" y="78" width="114" height="156" fill="#38bdf8" opacity="0.12" />
          <line x1="868" y1="156" x2="982" y2="156" stroke="#475569" strokeWidth="3" />
          <Trophy x={898} y={150} s={0.9} />
          <Trophy x={950} y={150} s={0.7} c="#e5e7eb" />
          <Trophy x={925} y={228} s={1} c="#d97706" />
        </g>
      </Hot>
      <Floor y={242} color="#334155" boards={false} />
      <g>
        <rect x="470" y="196" width="260" height="70" rx="10" fill={a} />
        <rect x="470" y="196" width="260" height="12" rx="6" fill="#fff" opacity="0.25" />
        <Crest x={600} y={234} s={0.9} a={b} b={a} />
      </g>
      <Plant x={1060} y={216} />
      <Plant x={140} y={216} s={0.9} />
      <text x="600" y="22" textAnchor="middle" fontSize="13" fontWeight="800" fill="#e2e8f0" letterSpacing="4" opacity="0.7">PRÉPA FC</text>
    </g>
  ),
  coach: ({ night, spots }) => (
    <g>
      <rect width="1200" height="300" fill="#2e2346" />
      <rect width="1200" height="300" fill="url(#wallgrad)" />
      <Hot spot={spots.board} lx={445} ly={36}>
        <g>
          <rect x="330" y="50" width="230" height="140" rx="6" fill="#a16207" />
          <rect x="338" y="58" width="214" height="124" fill="#d4a373" />
          {Array.from({ length: 8 }, (_, i) => {
            const cols = ["#fde047", "#f9a8d4", "#86efac", "#93c5fd"];
            const x = 350 + (i % 4) * 50, y = 68 + Math.floor(i / 4) * 56;
            return <g key={i} transform={`rotate(${(hash(i) - 0.5) * 12} ${x + 18} ${y + 18})`}><rect x={x} y={y} width="38" height="38" fill={cols[i % 4]} /><line x1={x + 6} y1={y + 12} x2={x + 30} y2={y + 12} stroke="#0003" strokeWidth="2" /><line x1={x + 6} y1={y + 20} x2={x + 26} y2={y + 20} stroke="#0003" strokeWidth="2" /><circle cx={x + 19} cy={y + 3} r="3" fill="#ef4444" /></g>;
          })}
        </g>
      </Hot>
      <Hot spot={spots.calendar} lx={650} ly={36}>
        <g>
          <rect x="595" y="52" width="110" height="120" rx="4" fill="#f8fafc" />
          <rect x="595" y="52" width="110" height="26" rx="4" fill="#ef4444" />
          <text x="650" y="70" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">NOV.</text>
          {Array.from({ length: 20 }, (_, i) => <rect key={i} x={603 + (i % 5) * 20} y={86 + Math.floor(i / 5) * 20} width="15" height="14" rx="2" fill={i === 6 ? "#fbbf24" : i === 11 ? "#f87171" : "#e2e8f0"} />)}
        </g>
      </Hot>
      <Hot spot={spots.whiteboard} lx={850} ly={36}>
        <g>
          <rect x="740" y="50" width="220" height="140" rx="6" fill="#e2e8f0" />
          <rect x="748" y="58" width="204" height="124" fill="#fff" />
          <polyline points="762,160 800,140 838,150 876,112 914,96 940,84" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {[[762, 160], [800, 140], [838, 150], [876, 112], [914, 96]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4" fill="#16a34a" />)}
          <line x1="760" y1="170" x2="944" y2="170" stroke="#94a3b8" strokeWidth="2" />
          <text x="768" y="80" fontSize="13" fontWeight="800" fill="#334155">Moyennes ↗</text>
        </g>
      </Hot>
      <Win x={1020} y={50} w={130} h={150} night={night} view="city" />
      <Floor y={236} />
      <Hot spot={spots.desk} lx={600} ly={186}>
        <g>
          <Desk x={420} y={210} w={360} />
          <rect x="470" y="190" width="70" height="22" rx="2" fill="#f8fafc" transform="rotate(-6 505 200)" />
          <rect x="476" y="184" width="70" height="22" rx="2" fill="#e2e8f0" transform="rotate(4 511 195)" />
          <text x="508" y="200" textAnchor="middle" fontSize="9" fontWeight="800" fill="#ef4444" transform="rotate(4 511 195)">DS</text>
          <rect x="600" y="168" width="78" height="44" rx="4" fill="#1f2937" />
          <rect x="605" y="173" width="68" height="34" fill="#38bdf8" opacity="0.6" />
          <rect x="590" y="210" width="98" height="5" rx="2" fill="#374151" />
        </g>
      </Hot>
      <Lamp x={710} y={166} on={night} />
      <Plant x={120} y={210} />
    </g>
  ),
  library: ({ night, spots }) => (
    <g>
      <rect width="1200" height="300" fill="#123a40" />
      <rect width="1200" height="300" fill="url(#wallgrad)" />
      <Shelf x={60} y={40} w={300} seed={3} />
      <Shelf x={840} y={40} w={300} seed={9} />
      <Hot spot={spots.poster} lx={600} ly={30}>
        <g>
          <rect x="520" y="40" width="160" height="110" rx="6" fill="#0f172a" />
          <rect x="528" y="48" width="144" height="94" rx="3" fill="url(#edhecgrad)" />
          <text x="600" y="84" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff">EDHEC</text>
          <text x="600" y="106" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fef3c7">3 AVRIL 2027</text>
          <text x="600" y="128" textAnchor="middle" fontSize="10" fill="#fef3c7">🎯 Pré-Master</text>
        </g>
      </Hot>
      <Hot spot={spots.clock} lx={420} ly={36}>
        <g>
          <circle cx="420" cy="80" r="30" fill="#f8fafc" stroke="#78350f" strokeWidth="5" />
          <line x1="420" y1="80" x2="420" y2="60" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" className="clock-m" />
          <line x1="420" y1="80" x2="434" y2="84" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
        </g>
      </Hot>
      <Win x={720} y={50} w={90} h={110} night={night} view="city" />
      <Floor y={236} color="#78350f" />
      <Desk x={380} y={214} w={440} color="#a16207" />
      <Hot spot={spots.cards} lx={470} ly={170}>
        <g>
          {[0, 1, 2].map((i) => <rect key={i} x={440 + i * 4} y={192 - i * 4} width="60" height="36" rx="4" fill={["#fde68a", "#bfdbfe", "#fff"][i]} stroke="#0002" />)}
          <text x="478" y="210" textAnchor="middle" fontSize="14">🔥</text>
        </g>
      </Hot>
      <Hot spot={spots.paper} lx={700} ly={170}>
        <g transform="rotate(-4 700 200)">
          <rect x="650" y="186" width="100" height="30" fill="#f1f5f9" />
          <rect x="656" y="191" width="40" height="4" fill="#0f172a" />
          <rect x="656" y="199" width="84" height="2" fill="#94a3b8" />
          <rect x="656" y="205" width="70" height="2" fill="#94a3b8" />
          <text x="728" y="196" fontSize="8" fontWeight="900" fill="#0f172a">LE MONDE</text>
        </g>
      </Hot>
      <Lamp x={560} y={170} on />
    </g>
  ),
  locker: ({ spots, a, b }) => (
    <g>
      <rect width="1200" height="300" fill="#1e3a5f" />
      {Array.from({ length: 30 }, (_, i) => <rect key={i} x={(i % 15) * 80} y={Math.floor(i / 15) * 40} width="78" height="38" fill="#ffffff" opacity="0.03" />)}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 150 + i * 100;
        return (
          <g key={i}>
            <rect x={x} y="50" width="92" height="180" rx="4" fill="#475569" />
            <rect x={x + 6} y="56" width="80" height="20" fill="#0f172a" opacity="0.4" />
            {Array.from({ length: 4 }, (_, j) => <rect key={j} x={x + 26 + j * 10} y="62" width="6" height="2" fill="#0f172a" />)}
            <path d={`M${x + 24} 92 L${x + 36} 86 Q${x + 46} 92 ${x + 56} 86 L${x + 68} 92 L${x + 64} 104 L${x + 60} 102 L${x + 60} 140 L${x + 32} 140 L${x + 32} 102 L${x + 28} 104 Z`} fill={i % 2 ? b : a} stroke="#0002" />
            <text x={x + 46} y="128" textAnchor="middle" fontSize="16" fontWeight="900" fill={i % 2 ? a : b}>{[1, 4, 5, 6, 8, 9, 10, 7, 11][i]}</text>
          </g>
        );
      })}
      <Hot spot={spots.tactics} lx={600} ly={20}>
        <g>
          <rect x="520" y="10" width="160" height="34" rx="4" fill="#065f46" stroke="#e5e7eb" strokeWidth="2" />
          <text x="600" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill="#f8fafc">4-3-3 · Tactique</text>
        </g>
      </Hot>
      <Floor y={238} color="#0f172a" boards={false} />
      <rect x="160" y="226" width="880" height="14" rx="4" fill="#a16207" />
      <circle cx="1080" cy="258" r="16" fill="#fff" stroke="#111" strokeWidth="2" />
    </g>
  ),
  president: ({ night, spots, a, b }) => (
    <g>
      <rect width="1200" height="300" fill="#3b1d24" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 100 + 6} y="140" width="88" height="96" rx="3" fill="#000" opacity="0.12" />)}
      <rect width="1200" height="300" fill="url(#wallgrad)" />
      <Hot spot={spots.window} lx={600} ly={30}><Win x={430} y={30} w={340} h={140} night={night} view="stadium" /></Hot>
      <Shelf x={90} y={60} w={220} rows={3} seed={21} />
      <Hot spot={spots.trophies} lx={980} ly={56}>
        <g>
          <rect x="890" y="70" width="190" height="10" fill="#78350f" />
          <Trophy x={930} y={70} s={0.9} />
          <Trophy x={985} y={70} s={1.1} />
          <Trophy x={1040} y={70} s={0.8} c="#e5e7eb" />
          <Crest x={985} y={130} s={1.2} a={a} b={b} />
        </g>
      </Hot>
      <Floor y={238} color="#451a03" />
      <Desk x={380} y={196} w={440} color="#7c2d12" />
      <Hot spot={spots.contract} lx={560} ly={160}>
        <g>
          <rect x="500" y="176" width="110" height="26" fill="#fefce8" transform="rotate(-3 555 189)" />
          <text x="555" y="192" textAnchor="middle" fontSize="9" fontWeight="800" fill="#0f172a" transform="rotate(-3 555 189)">CONTRAT</text>
          <line x1="590" y1="200" x2="630" y2="176" stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" className="pen" />
        </g>
      </Hot>
      <Hot spot={spots.phone} lx={720} ly={160}>
        <g>
          <rect x="690" y="180" width="54" height="18" rx="4" fill="#111827" />
          <path d="M694 180 q24 -18 46 0" stroke="#111827" strokeWidth="7" fill="none" strokeLinecap="round" className="ring-phone" />
        </g>
      </Hot>
      <Plant x={1130} y={214} />
    </g>
  ),
  tunnel: ({ spots, a }) => (
    <g>
      <rect width="1200" height="300" fill="#0b1120" />
      <polygon points="0,0 1200,0 760,110 440,110" fill="#1e293b" />
      <polygon points="0,300 1200,300 760,190 440,190" fill="#0f172a" />
      <polygon points="0,0 440,110 440,190 0,300" fill="#172033" />
      <polygon points="1200,0 760,110 760,190 1200,300" fill="#172033" />
      {Array.from({ length: 5 }, (_, i) => {
        const t = i / 5, x1 = 440 * t, x2 = 1200 - 440 * t, y = 110 * t;
        return <g key={i}><rect x={x1 + 40 * (1 - t)} y={y + 6} width={20 * (1 - t) + 6} height="5" fill="#fde68a" opacity="0.8" /><rect x={x2 - 40 * (1 - t) - 20} y={y + 6} width={20 * (1 - t) + 6} height="5" fill="#fde68a" opacity="0.8" /></g>;
      })}
      <Hot spot={spots.pitch} lx={600} ly={96}>
        <g>
          <rect x="440" y="110" width="320" height="80" fill="#4ade80" />
          <rect x="440" y="110" width="320" height="40" fill="#bae6fd" />
          <rect x="440" y="150" width="320" height="40" fill="#22c55e" />
          <rect x="440" y="110" width="320" height="80" fill="#fff" opacity="0.25" className="breathe-light" />
        </g>
      </Hot>
      <rect x="520" y="60" width="160" height="26" rx="4" fill={a} />
      <text x="600" y="78" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" letterSpacing="2">THIS IS PRÉPA FC</text>
    </g>
  ),
  trophies: ({ spots }) => (
    <g>
      <rect width="1200" height="300" fill="#1c1917" />
      {[200, 600, 1000].map((x, i) => <polygon key={i} points={`${x - 20},0 ${x + 20},0 ${x + 110},240 ${x - 110},240`} fill="#fde68a" opacity="0.07" />)}
      <Hot spot={spots.table} lx={300} ly={50}>
        <g>
          <rect x="190" y="70" width="220" height="150" rx="6" fill="#292524" stroke="#78716c" strokeWidth="3" />
          {Array.from({ length: 5 }, (_, i) => <g key={i}><rect x="205" y={86 + i * 26} width="190" height="18" rx="3" fill={i === 0 ? "#fbbf2433" : "#44403c"} /><text x="214" y={99 + i * 26} fontSize="11" fontWeight="700" fill="#e7e5e4">{i + 1}.</text></g>)}
        </g>
      </Hot>
      <Hot spot={spots.stats} lx={900} ly={50}>
        <g>
          <rect x="790" y="70" width="220" height="150" rx="6" fill="#292524" stroke="#78716c" strokeWidth="3" />
          {[40, 70, 55, 95, 80, 120].map((h, i) => <rect key={i} x={810 + i * 32} y={204 - h} width="22" height={h} rx="3" fill="#34d399" opacity={0.5 + i * 0.08} />)}
        </g>
      </Hot>
      <Floor y={240} color="#292524" boards={false} />
      <rect x="500" y="170" width="200" height="70" fill="#44403c" />
      <rect x="490" y="164" width="220" height="10" fill="#57534e" />
      <g className="float"><Trophy x={600} y={160} s={2} /></g>
    </g>
  ),
  corridor: () => (
    <g>
      <rect width="1200" height="300" fill="#1e293b" />
      <polygon points="0,0 1200,0 720,120 480,120" fill="#334155" />
      <polygon points="0,300 1200,300 720,190 480,190" fill="#7c2d12" />
      <polygon points="0,0 480,120 480,190 0,300" fill="#273449" />
      <polygon points="1200,0 720,120 720,190 1200,300" fill="#273449" />
      <rect x="480" y="120" width="240" height="70" fill="#0f172a" />
      {[[120, "COACH"], [300, "BIBLIO"]].map(([x, l], i) => <g key={i}><polygon points={`${x},${70 + i * 30} ${Number(x) + 60},${85 + i * 26} ${Number(x) + 60},${232 - i * 18} ${x},${250 - i * 22}`} fill="#475569" /><text x={Number(x) + 30} y={66 + i * 32} textAnchor="middle" fontSize="10" fontWeight="800" fill="#cbd5e1">{l}</text></g>)}
      {[[1080, "PRÉSIDENT"], [900, "VESTIAIRES"]].map(([x, l], i) => <g key={i}><polygon points={`${x},${70 + i * 30} ${Number(x) - 60},${85 + i * 26} ${Number(x) - 60},${232 - i * 18} ${x},${250 - i * 22}`} fill="#475569" /><text x={Number(x) - 30} y={66 + i * 32} textAnchor="middle" fontSize="10" fontWeight="800" fill="#cbd5e1">{l}</text></g>)}
      {Array.from({ length: 4 }, (_, i) => <rect key={i} x={560 - i * 6} y={8 + i * 26} width={80 + i * 12} height="5" rx="2" fill="#fde68a" opacity="0.6" />)}
    </g>
  ),
};

/**
 * Décor d'une pièce, en bandeau en haut de page. Le passage d'une pièce à l'autre traverse le couloir.
 * `spots` : objets cliquables de la pièce (clé = nom de l'objet dans le dessin).
 */
export function Scene({ id, spots = {} }: { id: SceneId; spots?: Record<string, Hotspot> }) {
  const club = useStore((s) => s.club);
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);
  const night = hour < 7 || hour >= 20;
  // Transition par le couloir quand on change de pièce
  const prev = useRef<SceneId>(id);
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    if (prev.current === id) return;
    prev.current = id;
    lastScene = id;
    setWalking(true);
    const t = setTimeout(() => setWalking(false), 650);
    return () => clearTimeout(t);
  }, [id]);
  useEffect(() => {
    // première apparition après un changement de rubrique : on part du couloir si la pièce a changé
    if (lastScene && lastScene !== id) {
      setWalking(true);
      const t = setTimeout(() => setWalking(false), 650);
      lastScene = id;
      return () => clearTimeout(t);
    }
    lastScene = id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`scene holo scene-${id}`}>
      <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" className={walking ? "scene-in" : ""} role="img" aria-label={SCENE_NAME[id]}>
        <defs>
          <linearGradient id="wallgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.06" /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></linearGradient>
          <linearGradient id="edhecgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d97706" /><stop offset="1" stopColor="#7c2d12" /></linearGradient>
        </defs>
        {SCENES[id]({ night, spots, a: club.colorA, b: club.colorB })}
      </svg>
      {walking && <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" className="corridor-walk" aria-hidden>{SCENES.corridor({ night, spots: {}, a: club.colorA, b: club.colorB })}</svg>}
      <span className="scene-name">{SCENE_NAME[id]}</span>
    </div>
  );
}
let lastScene: SceneId | null = null;
