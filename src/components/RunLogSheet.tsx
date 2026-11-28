/** Noter une sortie de course faite avec la montre : la séance, le ressenti, et les relevés de la Garmin. */
import { useState } from "react";
import { fmtShort, today, type ISODate } from "../lib/dates";
import { findOcc, toggleDone, type Occ } from "../lib/model";
import { FEELS, LAST, PROGRAM, blocksTotal, nextSession, recordRun, runTotal, sessionOf, type Feel } from "../lib/run";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";

/** Valider une séance : la course passe par la fiche de sortie (pour faire avancer le programme), le reste se coche. */
export function useValidate() {
  const apply = useStore((s) => s.apply);
  const open = useUI((s) => s.open);
  return (o: Occ, msg = "Séance validée") => {
    if (o.cat === "course" && !o.done) open({ kind: "runlog", key: o.key, date: o.date });
    else apply((p) => toggleDone(p, o.key), o.done ? undefined : msg);
  };
}

const num = (v: string) => {
  const x = Number(v.replace(",", "."));
  return v.trim() && Number.isFinite(x) && x > 0 ? x : undefined;
};

export default function RunLogSheet({ k, date }: { k?: string; date?: ISODate }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const close = useUI((s) => s.close);
  const occ = k ? findOcc(plan, k) : undefined;
  const d = date ?? occ?.date ?? today();
  const [n, setN] = useState(nextSession(plan.run, d).n);
  const [full, setFull] = useState(true);
  const s = sessionOf(n);
  const [ranMin, setRanMin] = useState(String(Math.round(runTotal(s) / 120)));
  const [feel, setFeel] = useState<Feel | null>(null);
  const [km, setKm] = useState("");
  const [hr, setHr] = useState("");
  const watch = !!plan.run.watch;

  const save = () => {
    if (!feel) return;
    const completed = full;
    const runSec = full ? runTotal(s) : Math.min(runTotal(s), Math.round((num(ranMin) ?? 0) * 60));
    apply(
      (p) => recordRun(p, {
        date: d, at: new Date().toISOString(), session: n, completed, feel, runSec,
        totalSec: full ? blocksTotal(s) : Math.round(runSec + 600), km: num(km), hr: num(hr), source: watch ? "garmin" : "manual",
      }, occ?.key),
      completed && feel < 4 ? `Séance ${n} validée. Prochaine : séance ${Math.min(n + 1, LAST)}.` : `Séance ${n} notée. La prochaine fois, on la refait : c'est la méthode.`,
    );
    close();
  };

  return (
    <div className="sheet-body">
      <h2 className="sheet-title">Sortie du {fmtShort(d)}</h2>
      <label className="field"><span>Séance du programme</span>
        <select id="rl-n" className="input" value={n} onChange={(e) => setN(Number(e.target.value))}>
          {PROGRAM.map((p) => <option key={p.n} value={p.n}>Séance {p.n} · {p.label}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Tu l'as faite en entier ?</span>
        <div className="seg">
          <button type="button" className={full ? "on" : ""} onClick={() => setFull(true)}>Oui, jusqu'au bout</button>
          <button type="button" className={!full ? "on" : ""} onClick={() => setFull(false)}>Non, arrêtée avant</button>
        </div>
      </div>
      {!full && (
        <label className="field"><span>Minutes courues (hors marche)</span>
          <input id="rl-ran" className="input sm" inputMode="decimal" value={ranMin} onChange={(e) => setRanMin(e.target.value)} />
        </label>
      )}
      <div className="field">
        <span>Comment c'était ?</span>
        <div className="feel">
          {([1, 2, 3, 4] as Feel[]).map((f) => (
            <button type="button" key={f} className={`feel-btn f${f} ${feel === f ? "on" : ""}`} onClick={() => setFeel(f)}>{FEELS[f]}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <label className="field"><span>Distance (km, sur ta montre)</span><input id="rl-km" className="input" inputMode="decimal" placeholder="ex. 3,2" value={km} onChange={(e) => setKm(e.target.value)} /></label>
        <label className="field"><span>Fréquence cardiaque moyenne</span><input id="rl-hr" className="input" inputMode="numeric" placeholder="ex. 152" value={hr} onChange={(e) => setHr(e.target.value)} /></label>
      </div>
      <p className="muted small">Facultatif : la distance et la FC moyenne sont dans le résumé de l'activité, sur la montre ou dans Garmin Connect. « Trop dur » ou pas finie : tu refais cette séance la prochaine fois.</p>
      <div className="sheet-actions">
        <span className="grow" />
        <button className="btn ghost" onClick={close}>Annuler</button>
        <button className="btn primary" disabled={!feel} onClick={save}>Enregistrer la sortie</button>
      </div>
    </div>
  );
}
