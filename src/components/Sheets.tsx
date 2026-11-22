/** Fenêtres : fiche d'une activité, report, réglages (catégories et objectifs). */
import { useEffect, useState } from "react";
import { addDays, fmtDur, fmtLong, nowMin, today } from "../lib/dates";
import { deleteOccurrence, findOcc, postpone, replanDay, toggleDone, uid, type Goal, type Scope } from "../lib/model";
import { useFocus } from "../lib/focus";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import EditSheet from "./EditSheet";
import { CopySheet } from "../views/Grades";
import { CatDot, PRIO_LABEL, quickDates, timeLabel, useCats } from "./common";
import { RoutineEditor, SleepScheduleEditor } from "./RoutineCards";
import RunLogSheet from "./RunLogSheet";

export default function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);
  if (!sheet) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true">
        {sheet.kind === "new" && <EditSheet mode="new" defaults={sheet.defaults} />}
        {sheet.kind === "edit" && <EditSheet mode="edit" keyId={sheet.key} />}
        {sheet.kind === "item" && <ItemSheet k={sheet.key} />}
        {sheet.kind === "postpone" && <PostponeSheet k={sheet.key} />}
        {sheet.kind === "settings" && <SettingsSheet />}
        {sheet.kind === "replan" && <ReplanSheet date={sheet.date} />}
        {sheet.kind === "help" && <HelpSheet />}
        {sheet.kind === "copy" && <CopySheet id={sheet.id} cat={sheet.cat} />}
        {sheet.kind === "runlog" && <RunLogSheet k={sheet.key} date={sheet.date} />}
      </div>
    </div>
  );
}

function ItemSheet({ k }: { k: string }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const { open, close } = useUI();
  const cats = useCats();
  const occ = findOcc(plan, k);
  const startFocus = useFocus((f) => f.start);
  const [del, setDel] = useState(false);
  const [mins, setMins] = useState<number | null>(null);
  if (!occ) return <div className="sheet-body"><p>Cette activité n'existe plus.</p><button className="btn" onClick={close}>Fermer</button></div>;
  const c = cats.get(occ.cat);
  const remove = (scope: Scope) => {
    apply((p) => deleteOccurrence(p, k, scope), "Supprimé");
    close();
  };
  return (
    <div className="sheet-body">
      <div className="item-head" style={{ ["--c" as string]: c?.color }}>
        <span className="pill" style={{ background: c?.color }}>{c?.name}</span>
        <span className={`prio-tag p-${occ.prio}`}>{PRIO_LABEL[occ.prio]}</span>
        {occ.series && <span className="pill ghost">Récurrent</span>}
      </div>
      <h2 className="sheet-title">{occ.title}</h2>
      <p className="muted">{fmtLong(occ.date)} · {timeLabel(occ)} {occ.start && `· ${fmtDur(occ.minutes)}`}</p>
      {occ.notes && <p className="notes">{occ.notes}</p>}

      {occ.check && (
        <div className="done-box">
          {occ.done ? (
            <>
              <p>✓ Validée : <b>{fmtDur(occ.done.minutes)}</b> comptées.</p>
              <button className="btn ghost" onClick={() => { apply((p) => toggleDone(p, k)); close(); }}>Annuler la validation</button>
            </>
          ) : (
            <>
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => { startFocus(occ); close(); }}>{occ.cat === "course" ? "▶ Lancer la séance de course guidée" : "▶ Démarrer en mode Focus"}</button>
                <button className="btn" onClick={() => { if (occ.cat === "course") open({ kind: "runlog", key: k, date: occ.date }); else { apply((p) => toggleDone(p, k, mins ?? occ.minutes), "Séance validée"); close(); } }}>✓ Déjà faite</button>
                <label className="inline-field">temps réel
                  <input id="i-mins" className="input sm" type="number" min={0} step={5} value={mins ?? occ.minutes} onChange={(e) => setMins(Number(e.target.value))} /> min
                </label>
              </div>
              <p className="muted small">Seules les séances validées comptent dans tes objectifs et ton bilan.</p>
            </>
          )}
        </div>
      )}

      <div className="sheet-actions">
        {!del ? (
          <>
            <button className="btn danger-ghost" onClick={() => setDel(true)}>Supprimer</button>
            <span className="grow" />
            {!occ.done && <button className="btn ghost" onClick={() => open({ kind: "postpone", key: k })}>Reporter</button>}
            <button className="btn" onClick={() => open({ kind: "edit", key: k })}>Modifier</button>
          </>
        ) : occ.series ? (
          <div className="confirm">
            <span>Supprimer :</span>
            <button className="btn danger" onClick={() => remove("one")}>Cette occurrence</button>
            <button className="btn danger-ghost" onClick={() => remove("following")}>Celle-ci et les suivantes</button>
            <button className="btn danger-ghost" onClick={() => remove("all")}>Toute la série</button>
            <button className="btn ghost" onClick={() => setDel(false)}>Non</button>
          </div>
        ) : (
          <div className="confirm">
            <span>Supprimer cette activité ?</span>
            <button className="btn danger" onClick={() => remove("all")}>Oui</button>
            <button className="btn ghost" onClick={() => setDel(false)}>Non</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostponeSheet({ k }: { k: string }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const close = useUI((s) => s.close);
  const occ = findOcc(plan, k);
  const [date, setDate] = useState(today());
  if (!occ) return null;
  const go = (to: string) => {
    apply((p) => postpone(p, k, to), `Reporté au ${fmtLong(to)}`);
    close();
  };
  return (
    <div className="sheet-body">
      <h2 className="sheet-title">Reporter « {occ.title} »</h2>
      <p className="muted small">Prévu le {fmtLong(occ.date)}. Même horaire, nouvelle date. Tu peux ensuite changer l'heure.</p>
      <div className="quick">
        {quickDates(occ.date).map(([l, d]) => <button key={l} className="btn" onClick={() => go(d)}>{l}</button>)}
      </div>
      <div className="row gap">
        <input id="p-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn primary" onClick={() => go(date)}>Reporter à cette date</button>
      </div>
      <div className="sheet-actions"><span className="grow" /><button className="btn ghost" onClick={close}>Annuler</button></div>
    </div>
  );
}

function SettingsSheet() {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const cloud = useStore((s) => s.cloud);
  const close = useUI((s) => s.close);
  const [newCat, setNewCat] = useState("");
  const setGoal = (id: string, patch: Partial<Goal>) => apply((p) => ({ ...p, goals: p.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  return (
    <div className="sheet-body">
      <h2 className="sheet-title">Réglages</h2>

      <h3 className="h3">Mes horaires de sommeil</h3>
      <SleepScheduleEditor />

      <h3 className="h3">Routines du matin et du soir</h3>
      <p className="muted small">Le matin part de ton lever du jour (début de « Routine du matin »), le soir de l'extinction (fin de la lecture). Les étapes liées au sommeil et à la lecture se gardent ; tu peux changer leur texte et leur minute.</p>
      <RoutineEditor />

      <h3 className="h3">Objectifs</h3>
      <p className="muted small">Comptés uniquement à partir des séances validées. « Semaine » : remis à zéro chaque lundi ; le Mois les additionne.</p>
      <div className="goal-edit">
        {plan.goals.map((g) => (
          <div key={g.id} className="goal-row">
            <input id={`g-l-${g.id}`} className="input" value={g.label} onChange={(e) => setGoal(g.id, { label: e.target.value })} />
            <select id={`g-c-${g.id}`} className="input" value={g.cat ?? ""} onChange={(e) => setGoal(g.id, { cat: e.target.value || undefined })}>
              <option value="">— manuel —</option>
              {plan.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input id={`g-t-${g.id}`} className="input sm" type="number" min={0} step={0.5} value={g.target} onChange={(e) => setGoal(g.id, { target: Number(e.target.value) })} />
            <select id={`g-u-${g.id}`} className="input sm" value={g.unit} onChange={(e) => setGoal(g.id, { unit: e.target.value as Goal["unit"] })}>
              <option value="h">h</option><option value="séances">séances</option><option value="€">€</option>
            </select>
            <select id={`g-p-${g.id}`} className="input sm" value={g.period} onChange={(e) => setGoal(g.id, { period: e.target.value as Goal["period"] })}>
              <option value="semaine">/ semaine</option><option value="mois">/ mois</option><option value="total">au total</option>
            </select>
            <button className="icon-btn" aria-label="Supprimer l'objectif" onClick={() => apply((p) => ({ ...p, goals: p.goals.filter((x) => x.id !== g.id) }), "Objectif supprimé")}>✕</button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => apply((p) => ({ ...p, goals: [...p.goals, { id: uid(), label: "Nouvel objectif", cat: "maths", unit: "h", target: 2, period: "semaine" }] }))}>+ Ajouter un objectif</button>
      </div>

      <h3 className="h3">Catégories</h3>
      <div className="cat-edit">
        {plan.categories.map((c) => (
          <div key={c.id} className="cat-row">
            <input id={`c-col-${c.id}`} type="color" value={c.color} onChange={(e) => apply((p) => ({ ...p, categories: p.categories.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)) }))} aria-label="Couleur" />
            <input id={`c-name-${c.id}`} className="input" value={c.name} onChange={(e) => apply((p) => ({ ...p, categories: p.categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))} />
            <label className="toggle small"><input id={`c-tr-${c.id}`} type="checkbox" checked={c.tracked} onChange={(e) => apply((p) => ({ ...p, categories: p.categories.map((x) => (x.id === c.id ? { ...x, tracked: e.target.checked } : x)) }))} /> dans le bilan</label>
          </div>
        ))}
        <div className="row gap">
          <input id="c-new" className="input" placeholder="Nouvelle catégorie (ex. Philo)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn" disabled={!newCat.trim()} onClick={() => {
            apply((p) => ({ ...p, categories: [...p.categories, { id: uid(), name: newCat.trim(), color: "#8FA3FF", tracked: true }] }), "Catégorie ajoutée");
            setNewCat("");
          }}>Ajouter</button>
        </div>
      </div>

      <h3 className="h3">Sauvegarde</h3>
      <p className="small">
        <CatDot color={cloud.status === "ok" ? "var(--lime)" : cloud.status === "error" ? "var(--danger)" : "var(--orange)"} />{" "}
        {cloud.status === "ok" ? "Enregistré dans ton compte : mêmes données sur Mac, iPad et téléphone." : cloud.msg ?? "Synchronisation…"}
      </p>
      <div className="sheet-actions"><span className="grow" /><button className="btn primary" onClick={close}>Fermer</button></div>
    </div>
  );
}

function ReplanSheet({ date }: { date: string }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const close = useUI((s) => s.close);
  const [from] = useState(nowMin());
  const r = replanDay(plan, date, from, 22 * 60 + 30);
  const tomorrow = addDays(date, 1);
  const go = (withOverflow: boolean) => {
    apply((p) => {
      let next = replanDay(p, date, from, 22 * 60 + 30).plan;
      if (withOverflow) for (const o of r.overflow) next = postpone(next, o.key, tomorrow);
      return next;
    }, withOverflow && r.overflow.length ? `Journée recalée, ${r.overflow.length} séance${r.overflow.length > 1 ? "s" : ""} reportée${r.overflow.length > 1 ? "s" : ""} à demain` : "Journée recalée");
    close();
  };
  return (
    <div className="sheet-body">
      <h2 className="sheet-title">Replanifier la suite de ma journée</h2>
      <p className="muted small">À partir de maintenant. Les séances à venir gardent leur créneau ; celles que tu as manquées se glissent dans les trous libres, l'important d'abord. Cours, repas, khôlles et routine du soir ne bougent pas.</p>
      {r.moves.length === 0 && r.overflow.length === 0 ? <p>Rien à recaler : ta journée tient.</p> : (
        <>
          {r.moves.length > 0 && (
            <ul className="replan">
              {r.moves.map((m) => <li key={m.key}><span className="rp-from">{m.from}</span><span className="rp-arrow">→</span><b className="rp-to">{m.to}</b><span>{m.title}</span></li>)}
            </ul>
          )}
          {r.overflow.length > 0 && (
            <div className="replan-over">
              <b>Ne rentre plus aujourd'hui ({r.overflow.length})</b>
              <ul>{r.overflow.map((o) => <li key={o.key}>{o.title} <span className="muted">· {fmtDur(o.minutes)}{o.prio === "facultatif" ? " · facultatif" : ""}</span></li>)}</ul>
            </div>
          )}
        </>
      )}
      <div className="sheet-actions">
        <button className="btn ghost" onClick={close}>Annuler</button>
        <span className="grow" />
        {r.overflow.length > 0 && <button className="btn" onClick={() => go(false)} disabled={!r.moves.length}>Recaler seulement</button>}
        <button className="btn primary" onClick={() => go(true)} disabled={!r.moves.length && !r.overflow.length}>
          {r.overflow.length ? "Recaler + reporter le reste à demain" : "Recaler ma journée"}
        </button>
      </div>
    </div>
  );
}

function HelpSheet() {
  const close = useUI((s) => s.close);
  const keys: Array<[string, string]> = [
    ["J  S  M  A", "Journée, Semaine, Mois, Année"], ["C", "Onglet Course"], ["V", "Onglet Vendredi (quiz)"], ["T", "Revenir à aujourd'hui"],
    ["←  →", "Jour, semaine ou mois précédent / suivant"], ["N", "Ajouter une tâche ou un événement"],
    ["F", "Démarrer la prochaine séance en mode Focus"], ["R", "Replanifier la suite de la journée"], ["?", "Cette aide"],
  ];
  return (
    <div className="sheet-body">
      <h2 className="sheet-title">Aide</h2>
      <h3 className="h3">Raccourcis clavier (Mac)</h3>
      <ul className="keys">{keys.map(([k, l]) => <li key={k}><kbd>{k}</kbd><span>{l}</span></li>)}</ul>

      <h3 className="h3">Cadence sur l'écran d'accueil (iPhone)</h3>
      <ol className="howto">
        <li>Enregistre l'icône de Cadence dans tes Photos (je te l'ai envoyée dans la conversation).</li>
        <li>App <b>Raccourcis</b> → <b>+</b> → <b>Ajouter une action</b> → « Ouvrir les URL » → colle le lien de Cadence.</li>
        <li>Touche <b>ⓘ</b> (ou la flèche en haut) → <b>Sur l'écran d'accueil</b>.</li>
        <li>Touche l'icône → <b>Choisir une photo</b> → l'icône Cadence. Nom : « Cadence » → <b>Ajouter</b>.</li>
      </ol>
      <p className="muted small">Plus simple mais avec une icône générique : dans Safari, bouton Partager → « Sur l'écran d'accueil ».</p>
      <div className="sheet-actions"><span className="grow" /><button className="btn primary" onClick={close}>OK</button></div>
    </div>
  );
}
