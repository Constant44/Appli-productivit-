/** Ajouter ou modifier n'importe quoi : tâche, séance, cours, événement, activité récurrente. */
import { useState } from "react";
import { DAY_SHORT, fmtLong, today, weekday } from "../lib/dates";
import { addActivity, deleteOccurrence, editOccurrence, findOcc, uid, type Activity, type OccPatch, type Prio, type Repeat, type Scope } from "../lib/model";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { PRIO_LABEL } from "./common";

type Draft = {
  title: string; cat: string; prio: Prio; date: string; timed: boolean; start: string; end: string; minutes: number;
  check: boolean; deadline: boolean; notes: string; recurring: boolean; days: number[]; every: 1 | 2; until: string;
};

const SCOPES: Array<[Scope, string]> = [["one", "Cette occurrence"], ["following", "Celle-ci et les suivantes"], ["all", "Toute la série"]];

export default function EditSheet({ mode, keyId, defaults }: { mode: "new" | "edit"; keyId?: string; defaults?: Partial<Activity> }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const close = useUI((s) => s.close);
  const occ = keyId ? findOcc(plan, keyId) : undefined;
  const act = occ ? plan.activities.find((a) => a.id === occ.id) : undefined;

  const init: Draft = occ
    ? {
        title: occ.title, cat: occ.cat, prio: occ.prio, date: occ.date, timed: !!occ.start, start: occ.start ?? "09:00", end: occ.end ?? "09:45",
        minutes: occ.minutes || 30, check: occ.check, deadline: occ.deadline, notes: occ.notes ?? "",
        recurring: !!act?.repeat, days: act?.repeat?.days ?? [weekday(occ.date)], every: act?.repeat?.every ?? 1, until: act?.repeat?.until ?? "",
      }
    : {
        title: defaults?.title ?? "", cat: defaults?.cat ?? "maths", prio: defaults?.prio ?? "important", date: defaults?.date ?? today(),
        timed: defaults?.start !== undefined || defaults?.minutes === undefined, start: defaults?.start ?? "09:00", end: defaults?.end ?? "09:45",
        minutes: 30, check: defaults?.check ?? true, deadline: false, notes: "", recurring: false, days: [weekday(defaults?.date ?? today())], every: 1, until: "2027-04-03",
      };
  const [d, setD] = useState<Draft>(init);
  const [scope, setScope] = useState<Scope>("one");
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const isSeries = !!act?.repeat;

  const fields = (): Partial<Activity> => ({
    title: d.title.trim(), cat: d.cat, prio: d.prio, check: d.check, deadline: d.deadline, notes: d.notes.trim() || undefined,
    ...(d.timed ? { start: d.start, end: d.end, minutes: undefined } : { start: undefined, end: undefined, minutes: d.minutes }),
  });
  const repeat = (): Repeat => ({ days: [...d.days].sort(), every: d.every, ...(d.until ? { until: d.until } : {}) });

  const save = () => {
    if (!d.title.trim()) return setErr("Donne un nom à l'activité.");
    if (d.timed && d.end <= d.start && d.end !== "00:00") return setErr("L'heure de fin doit être après l'heure de début.");
    if (d.recurring && !d.days.length) return setErr("Choisis au moins un jour de répétition.");
    if (mode === "new") {
      const a: Activity = { id: uid(), date: d.date, source: "user", ...fields(), ...(d.recurring ? { repeat: repeat() } : {}) } as Activity;
      apply((p) => addActivity(p, a), d.recurring ? "Activité récurrente ajoutée" : "Ajouté au planning");
      return close();
    }
    if (!occ) return close();
    const patch: OccPatch = { ...fields(), date: d.date };
    if (!isSeries && d.recurring) patch.repeat = repeat();
    if (isSeries && !d.recurring) patch.repeat = null;
    if (isSeries && d.recurring && scope !== "one") {
      const r = repeat();
      if (JSON.stringify(r) !== JSON.stringify(act!.repeat)) patch.repeat = r;
    }
    if (isSeries && d.date === occ.date) delete patch.date;
    apply((p) => editOccurrence(p, occ.key, patch, isSeries ? scope : "all"), "Modification enregistrée");
    close();
  };

  const remove = () => {
    if (!occ) return;
    apply((p) => deleteOccurrence(p, occ.key, isSeries ? scope : "all"), "Supprimé");
    close();
  };

  return (
    <div className="sheet-body">
      <h2 className="sheet-title">{mode === "new" ? "Ajouter au planning" : "Modifier"}</h2>
      {occ && isSeries && <p className="muted small">Activité récurrente · occurrence du {fmtLong(occ.date)}</p>}

      <label className="field">
        <span>Nom</span>
        <input id="f-title" className="input" autoFocus value={d.title} onChange={(e) => up({ title: e.target.value })} placeholder="Ex. Maths : exercices chapitre 5" />
      </label>

      <div className="field">
        <span>Catégorie</span>
        <div className="chips">
          {plan.categories.map((c) => (
            <button type="button" key={c.id} className={`chip ${d.cat === c.id ? "on" : ""}`} style={{ ["--c" as string]: c.color }} onClick={() => up({ cat: c.id, check: !["cours", "vie", "libre", "eval"].includes(c.id) })}>
              <span className="dot" style={{ background: c.color }} />{c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <span>Priorité</span>
          <div className="seg">
            {(["fixe", "important", "facultatif"] as Prio[]).map((p) => (
              <button type="button" key={p} className={d.prio === p ? `on p-${p}` : ""} onClick={() => up({ prio: p })}>{PRIO_LABEL[p]}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Type</span>
          <div className="seg">
            <button type="button" className={d.check ? "on" : ""} onClick={() => up({ check: true })}>Tâche à cocher</button>
            <button type="button" className={!d.check ? "on" : ""} onClick={() => up({ check: false })}>Événement</button>
          </div>
        </div>
      </div>

      <div className="grid3">
        <label className="field">
          <span>{d.recurring ? "À partir du" : "Date"}</span>
          <input id="f-date" className="input" type="date" value={d.date} onChange={(e) => up({ date: e.target.value })} />
        </label>
        {d.timed ? (
          <>
            <label className="field"><span>Début</span><input id="f-start" className="input" type="time" step={300} value={d.start} onChange={(e) => up({ start: e.target.value })} /></label>
            <label className="field"><span>Fin</span><input id="f-end" className="input" type="time" step={300} value={d.end} onChange={(e) => up({ end: e.target.value })} /></label>
          </>
        ) : (
          <label className="field"><span>Durée (min)</span><input id="f-min" className="input" type="number" min={0} step={5} value={d.minutes} onChange={(e) => up({ minutes: Number(e.target.value) })} /></label>
        )}
      </div>
      <div className="row wrap gap">
        <label className="toggle"><input id="f-timed" type="checkbox" checked={d.timed} onChange={(e) => up({ timed: e.target.checked })} /> Avec un horaire</label>
        <label className="toggle"><input id="f-deadline" type="checkbox" checked={d.deadline} onChange={(e) => up({ deadline: e.target.checked })} /> Échéance importante (DS, khôlle, rendu)</label>
        <label className="toggle"><input id="f-rec" type="checkbox" checked={d.recurring} onChange={(e) => up({ recurring: e.target.checked })} /> Récurrent</label>
      </div>

      {d.recurring && (
        <div className="rec-box">
          <div className="field">
            <span>Jours</span>
            <div className="days">
              {DAY_SHORT.map((l, i) => (
                <button type="button" key={l} className={d.days.includes(i) ? "on" : ""} onClick={() => up({ days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i] })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <span>Fréquence</span>
              <div className="seg">
                <button type="button" className={d.every === 1 ? "on" : ""} onClick={() => up({ every: 1 })}>Chaque semaine</button>
                <button type="button" className={d.every === 2 ? "on" : ""} onClick={() => up({ every: 2 })}>Une semaine sur deux</button>
              </div>
            </div>
            <label className="field"><span>Jusqu'au (facultatif)</span><input id="f-until" className="input" type="date" value={d.until} onChange={(e) => up({ until: e.target.value })} /></label>
          </div>
        </div>
      )}

      <label className="field">
        <span>Notes</span>
        <textarea id="f-notes" className="input" rows={2} value={d.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Chapitre, exercices, salle…" />
      </label>

      {isSeries && (
        <div className="field scope">
          <span>Appliquer à</span>
          <div className="seg">
            {SCOPES.map(([s, l]) => <button type="button" key={s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>{l}</button>)}
          </div>
        </div>
      )}

      {err && <p className="err">{err}</p>}

      <div className="sheet-actions">
        {mode === "edit" && !confirmDel && <button type="button" className="btn danger-ghost" onClick={() => setConfirmDel(true)}>Supprimer</button>}
        {confirmDel && (
          <div className="confirm">
            <span>Supprimer {isSeries ? SCOPES.find(([s]) => s === scope)![1].toLowerCase() : "cette activité"} ?</span>
            <button type="button" className="btn danger" onClick={remove}>Oui, supprimer</button>
            <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>Non</button>
          </div>
        )}
        <span className="grow" />
        <button type="button" className="btn ghost" onClick={close}>Annuler</button>
        <button type="button" className="btn primary" onClick={save}>{mode === "new" ? "Ajouter" : "Enregistrer"}</button>
      </div>
    </div>
  );
}
