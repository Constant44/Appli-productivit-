import { useMemo, type ReactNode } from "react";
import { addDays, fmtDur, fmtShort, today, type ISODate } from "../lib/dates";
import type { Category, Occ } from "../lib/model";
import { useStore } from "../lib/store";

export function useCats() {
  const cats = useStore((s) => s.plan.categories);
  return useMemo(() => new Map<string, Category>(cats.map((c) => [c.id, c])), [cats]);
}

export const PRIO_LABEL = { fixe: "Obligation fixe", important: "Important", facultatif: "Facultatif" } as const;

export function CatDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="dot" style={{ background: color, width: size, height: size }} aria-hidden />;
}

export function Ring({ value, size = 96, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lime)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="ring-label">{label ?? `${Math.round(v * 100)} %`}</div>
    </div>
  );
}

export function Bar({ value, max, color = "var(--blue)", thin }: { value: number; max: number; color?: string; thin?: boolean }) {
  const p = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={`bar ${thin ? "thin" : ""}`} role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

export const timeLabel = (o: Occ) => (o.start ? `${o.start}${o.end ? `–${o.end}` : ""}` : o.minutes ? fmtDur(o.minutes) : "Sans horaire");

/** Choix rapide d'une date de report. */
export function quickDates(from: ISODate): Array<[string, ISODate]> {
  const t = today();
  const base = from < t ? t : from;
  const d = new Date(`${base}T12:00:00`);
  const toMonday = ((8 - d.getDay()) % 7) || 7;
  return [
    ["Demain", addDays(base, 1)],
    ["Après-demain", addDays(base, 2)],
    [`Lundi (${fmtShort(addDays(base, toMonday))})`, addDays(base, toMonday)],
    ["Dans une semaine", addDays(from, 7)],
  ];
}
