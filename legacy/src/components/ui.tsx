import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "../lib/store";
import { subjectColor } from "../lib/utils";

export function Modal({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}

export const Bar = ({ value, max = 1, tone }: { value: number; max?: number; tone?: "gold" | "blue" | "red" }) => (
  <div className={`bar ${tone ?? ""}`}>
    <div style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%` }} />
  </div>
);

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: Array<[T, ReactNode]>; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export function SubjectSelect({ value, onChange, allowEmpty }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const subjects = useStore((s) => s.settings.subjects);
  const [custom, setCustom] = useState(false);
  const all = value && !subjects.includes(value) ? [...subjects, value] : subjects;
  if (custom)
    return (
      <input
        className="input" autoFocus placeholder="Nouvelle matière" value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (value && !subjects.includes(value)) useStore.getState().updateSettings({ subjects: [...subjects, value] });
          setCustom(false);
        }}
      />
    );
  return (
    <select className="input" value={value} onChange={(e) => (e.target.value === "__new" ? (onChange(""), setCustom(true)) : onChange(e.target.value))}>
      {allowEmpty && <option value="">— Aucune —</option>}
      {all.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
      <option value="Perso">Perso</option>
      <option value="__new">+ Autre matière…</option>
    </select>
  );
}

export const SubjectDot = ({ subject }: { subject: string }) => <span className="dot" style={{ background: subjectColor(subject) }} />;

export const ovrColor = (o: number) =>
  o >= 85 ? "#a78bfa" : o >= 78 ? "#fbbf24" : o >= 70 ? "#22c55e" : o >= 62 ? "#60a5fa" : o >= 54 ? "#94a3b8" : "#64748b";

export const Ovr = ({ v }: { v: number }) => (
  <span className="ovr" style={{ background: ovrColor(v) + "22", color: ovrColor(v), border: `1px solid ${ovrColor(v)}66` }}>{v}</span>
);

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ""}`} onClick={() => dismiss(t.id)}>
          <div className="t">{t.title}</div>
          {t.body && <div className="b">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, step = 5, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; min?: number; step?: number; placeholder?: string }) {
  return (
    <input
      className="input" type="number" inputMode="numeric" min={min} step={step} placeholder={placeholder}
      value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

/** Saisie de durée en minutes avec raccourcis. */
export function DurationInput({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <NumberInput value={value} onChange={onChange} placeholder="minutes" />
      <div className="row" style={{ gap: 4 }}>
        {[15, 30, 45, 60, 90, 120, 180].map((m) => (
          <button key={m} type="button" className="btn sm" onClick={() => onChange(m)}>
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </button>
        ))}
      </div>
    </div>
  );
}
