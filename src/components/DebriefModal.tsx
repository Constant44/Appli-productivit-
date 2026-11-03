import { useState } from "react";
import { useStore } from "../lib/store";
import type { Debrief, Evaluation } from "../lib/types";
import { Field, Modal, Seg } from "./ui";

const CAUSES: Array<[Debrief["cause"], string]> = [
  ["cours", "📚 Cours pas su"],
  ["methode", "🧭 Méthode"],
  ["temps", "⏱️ Manque de temps"],
  ["inattention", "🙈 Inattention"],
  ["stress", "😰 Stress"],
];
export const CAUSE_LABEL = Object.fromEntries(CAUSES) as Record<Debrief["cause"], string>;

/** Debrief après un DS ou une khôlle : 5 minutes, à chaud. Les erreurs partent dans le carnet (cartes de révision). */
export function DebriefModal({ ev, onClose }: { ev: Evaluation; onClose: () => void }) {
  const saveDebrief = useStore((s) => s.saveDebrief);
  const d = ev.debrief;
  const [feeling, setFeeling] = useState<Debrief["feeling"]>(d?.feeling ?? 3);
  const [good, setGood] = useState(d?.good ?? "");
  const [errors, setErrors] = useState(d?.errors.length ? d.errors : [{ q: "", a: "" }]);
  const [cause, setCause] = useState<Debrief["cause"]>(d?.cause ?? "cours");
  const [nextTime, setNextTime] = useState(d?.nextTime ?? "");
  const setErr = (i: number, patch: Partial<{ q: string; a: string }>) => setErrors(errors.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Modal
      title={`Debrief : ${ev.type} de ${ev.subject}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={() => { saveDebrief(ev.id, { at: new Date().toISOString(), feeling, good, errors, cause, nextTime }); onClose(); }}>Enregistrer</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Ressenti">
          <div className="row" style={{ gap: 6 }}>
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button key={n} className={`btn sm ${feeling === n ? "primary" : ""}`} onClick={() => setFeeling(n)}>{["😣", "😕", "😐", "🙂", "😄"][n - 1]}</button>
            ))}
          </div>
        </Field>
        <Field label="Ce qui a marché"><input className="input" value={good} onChange={(e) => setGood(e.target.value)} placeholder="ex : bien géré le temps sur la partie 1" /></Field>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Erreurs → carnet d'erreurs (révisé pendant l'échauffement). Écris la question, puis la bonne réponse ou la bonne méthode.</div>
          <div className="stack" style={{ gap: 8 }}>
            {errors.map((x, i) => (
              <div key={i} className="stack" style={{ gap: 4, padding: 8, border: "1px solid var(--line)", borderRadius: 10 }}>
                <input className="input" value={x.q} onChange={(e) => setErr(i, { q: e.target.value })} placeholder="Question / notion ratée (ex : condition du second ordre pour un max de profit ?)" />
                <textarea className="input" rows={2} value={x.a} onChange={(e) => setErr(i, { a: e.target.value })} placeholder="Bonne réponse ou méthode" />
                {errors.length > 1 && <button className="btn sm ghost" style={{ alignSelf: "flex-end" }} onClick={() => setErrors(errors.filter((_, j) => j !== i))}>Supprimer</button>}
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setErrors([...errors, { q: "", a: "" }])}>+ Une erreur</button>
        </div>
        <Field label="Cause principale des points perdus">
          <Seg value={cause} onChange={setCause} options={CAUSES} />
        </Field>
        <Field label="La prochaine fois, je…"><input className="input" value={nextTime} onChange={(e) => setNextTime(e.target.value)} placeholder="ex : refaire les exos type avant de relire le cours" /></Field>
      </div>
    </Modal>
  );
}
