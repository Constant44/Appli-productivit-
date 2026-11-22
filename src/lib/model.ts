/**
 * Modèle unique de l'appli : toutes les vues (Journée, Semaine, Mois, Année, Bilan) lisent les mêmes données.
 *
 * - Une ACTIVITÉ est soit ponctuelle (une date), soit récurrente (jours de la semaine, toutes les 1 ou 2 semaines).
 * - Une OCCURRENCE est calculée à la volée : rien n'est dupliqué, donc rien ne peut se dédoubler à l'actualisation.
 *   Clé stable : `<id>@<date d'origine>` (série) ou `<id>@1` (ponctuelle).
 * - Une EXCEPTION (override) modifie, déplace ou supprime UNE occurrence d'une série sans toucher au reste.
 * - VALIDÉ ≠ PROGRAMMÉ : seules les occurrences cochées (`done`) comptent comme réalisées.
 */
import { addDays, daysBetween, inHolidays, mondayOf, range, toMin, weekday, type ISODate } from "./dates";
import type { Copy } from "./grades";
import { DEFAULT_ROUTINES, type RoutineLog, type Routines } from "./routineDefaults";
import type { RunState } from "./run";
import { adaptGym, RUN_CATEGORY, RUN_GOAL, runSeries } from "./runSetup";

export type Prio = "fixe" | "important" | "facultatif";
export type Scope = "one" | "following" | "all";

export type Category = { id: string; name: string; color: string; /** compte dans le bilan (travail, sport…) */ tracked: boolean };

export type Repeat = {
  /** 0 = lundi … 6 = dimanche */
  days: number[];
  every: 1 | 2;
  until?: ISODate;
  /** pas d'occurrence pendant les vacances scolaires (cours) */
  skipHolidays?: boolean;
};

export type Activity = {
  id: string;
  title: string;
  cat: string;
  prio: Prio;
  /** date (ponctuelle) ou première date (série) */
  date: ISODate;
  start?: string;
  end?: string;
  /** durée d'une tâche sans horaire */
  minutes?: number;
  repeat?: Repeat;
  /** true : séance / tâche à cocher (comptée dans le suivi) ; false : événement fixe (cours, repas, échéance) */
  check: boolean;
  /** échéance importante (DS, khôlle, rendu, concours) : mise en avant dans Mois et Année */
  deadline?: boolean;
  notes?: string;
  /** seed : planning de départ ; gcal : ton Google Agenda ; inbox : ajouté par l'import du soir ; user : toi */
  source?: "seed" | "gcal" | "inbox" | "user";
  extId?: string;
  /** modifiée à la main : l'import de l'agenda ne l'écrase plus */
  edited?: boolean;
};

export type OccFields = Partial<Pick<Activity, "title" | "cat" | "prio" | "start" | "end" | "minutes" | "notes" | "check" | "deadline">>;
export type Override = OccFields & { date?: ISODate; deleted?: boolean };
export type Done = { at: string; minutes: number; /** séance faite en mode Focus : décrochages comptés */ focus?: boolean; distractions?: number };
/** Nuit du jour J : coucher (souvent après minuit) et lever du lendemain matin, en ISO. */
export type Night = { bed?: string; wake?: string };
/** Horaires de sommeil par jour (0 = lundi) : lever le matin, extinction le soir (absente = soir libre). */
export type DaySleep = { wake: string; bed?: string };
export type Prefs = {
  bedTarget: string; wakeTarget: string; dayEnd: string; schedule?: DaySleep[];
  /** musique proposée à chaque démarrage du mode Focus (lien https) ; "" = aucune */
  focusMusic?: string;
};
export const DEFAULT_FOCUS_MUSIC = "https://www.youtube.com/watch?v=XGNjC_cKKfI";
/** Le lien de musique à proposer (seulement un lien https, jamais autre chose). */
export const focusMusicUrl = (prefs: Prefs): string | undefined => {
  const u = (prefs.focusMusic ?? DEFAULT_FOCUS_MUSIC).trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : undefined;
};
export const DEFAULT_PREFS: Prefs = { bedTarget: "23:15", wakeTarget: "07:15", dayEnd: "22:30" };
export type Postpone = { key: string; from: ISODate; to: ISODate; at: string };

export type Goal = {
  id: string;
  label: string;
  cat?: string;
  unit: "h" | "séances" | "€";
  target: number;
  period: "semaine" | "mois" | "total";
  /** valeur saisie à la main (épargne…) */
  manual?: number;
};

export type Plan = {
  v: 2;
  categories: Category[];
  activities: Activity[];
  overrides: Record<string, Override>;
  done: Record<string, Done>;
  postponed: Postpone[];
  goals: Goal[];
  reviews: Record<ISODate, unknown>;
  /** levers et couchers, par date du jour (le coucher après minuit compte pour la veille) */
  sleep: Record<ISODate, Night>;
  prefs: Prefs;
  /** copies corrigées et erreurs (DS, synthèses, khôlles) */
  copies: Copy[];
  /** routines du matin et du soir (étapes modifiables dans les réglages) */
  routines: Routines;
  /** étapes cochées, par jour (matin) ou par soir */
  routineLog: RoutineLog;
  /** course à pied : journal des sorties du programme */
  run: RunState;
  /** mises à jour du planning envoyées par Claude (inbox-plan) déjà appliquées */
  patched?: string[];
};

/** Titres et notes corrigés depuis la première version (appliqués seulement si tu n'y as pas touché). */
const RETITLE: Record<string, { from: string; title: string; notes?: string }> = {
  lecture: {
    from: "Téléphone posé sur le lit · lecture · extinction 23 h 15",
    title: "Lecture au lit (livre papier) · extinction 23 h 15",
    notes: "Téléphone en charge loin du lit depuis 22 h 30, réveil à l'autre bout de la chambre. Pas d'écran.",
  },
};
const SYNTH_NOTE = "Non noté : c'est corrigé par PGE-PGO. Quand tu reçois la correction, ajoute-la dans Bilan → Analyse des copies (sans note).";
const SYNTH_IDS = new Set(["ev-synth-1", "ev-synth-2", "ev-synth-3", "ev-synth-4"]);

function migrateActivity(a: Activity): Activity {
  if (a.edited) return a;
  const r = Object.values(RETITLE).find((x) => x.from === a.title);
  if (r) return { ...a, title: r.title, notes: r.notes ?? a.notes };
  if (SYNTH_IDS.has(a.id)) {
    const title = a.title.includes("non noté") ? a.title : `${a.title.replace(" (Drive)", "")} · non noté, corrigé`;
    if (title !== a.title || !a.notes) return { ...a, title, notes: a.notes || SYNTH_NOTE };
  }
  return a;
}

/** Première ouverture avec la course à pied : catégorie, objectif, 3 sorties par semaine, Basic-Fit après la course. */
function addRunning(p: Plan): Plan {
  if (p.run) return p;
  const ids = new Set((p.activities ?? []).map((a) => a.id));
  return {
    ...p,
    run: { log: [] },
    categories: (p.categories ?? []).some((c) => c.id === RUN_CATEGORY.id) ? p.categories : [...(p.categories ?? []), { ...RUN_CATEGORY }],
    activities: [...(p.activities ?? []).map(adaptGym), ...runSeries().filter((a) => !ids.has(a.id))],
    goals: (p.goals ?? []).some((g) => g.id === RUN_GOAL.id) ? p.goals : [...(p.goals ?? []), { ...RUN_GOAL }],
  };
}

/** Complète un plan enregistré par une version antérieure. */
export const normalize = (p0: Plan): Plan => normalizeBase(addRunning(p0));
const normalizeBase = (p: Plan): Plan => ({
  ...p, sleep: p.sleep ?? {}, prefs: { ...DEFAULT_PREFS, ...(p.prefs ?? {}) }, postponed: p.postponed ?? [], reviews: p.reviews ?? {},
  copies: p.copies ?? [],
  // la tirelire PS5 a été retirée à ta demande
  goals: (p.goals ?? []).filter((g) => g.id !== "g-ps5"),
  activities: (p.activities ?? []).map(migrateActivity),
  routines: p.routines?.matin && p.routines?.soir ? p.routines : DEFAULT_ROUTINES,
  routineLog: p.routineLog ?? {},
});

export type Occ = {
  key: string;
  id: string;
  orig: ISODate;
  date: ISODate;
  start?: string;
  end?: string;
  minutes: number;
  title: string;
  cat: string;
  prio: Prio;
  check: boolean;
  deadline: boolean;
  notes?: string;
  series: boolean;
  moved: boolean;
  done?: Done;
  source?: Activity["source"];
};

export type OccPatch = OccFields & { date?: ISODate; repeat?: Repeat | null };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const ONCE = "1";
export const keyOf = (id: string, orig: ISODate | typeof ONCE) => `${id}@${orig}`;
export const parseKey = (key: string) => {
  const i = key.lastIndexOf("@");
  return { id: key.slice(0, i), orig: key.slice(i + 1) };
};

/** Durée en minutes (une plage qui passe minuit est comptée jusqu'au lendemain). */
export const durationOf = (start?: string, end?: string, minutes?: number) => {
  if (start && end) {
    const d = toMin(end) - toMin(start);
    return d > 0 ? d : d + 24 * 60;
  }
  return minutes ?? 30;
};

/** La série a-t-elle une occurrence d'origine ce jour-là ? */
export function seriesHits(a: Activity, d: ISODate): boolean {
  const r = a.repeat;
  if (!r) return d === a.date;
  if (d < a.date || (r.until && d > r.until)) return false;
  if (!r.days.includes(weekday(d))) return false;
  if (r.every === 2 && Math.round(daysBetween(mondayOf(a.date), mondayOf(d)) / 7) % 2 !== 0) return false;
  if (r.skipHolidays && inHolidays(d)) return false;
  return true;
}

function makeOcc(plan: Plan, a: Activity, key: string, orig: ISODate, ov?: Override): Occ {
  const f = { ...a, ...(ov ?? {}) };
  return {
    key, id: a.id, orig, date: ov?.date ?? (a.repeat ? orig : a.date),
    start: f.start, end: f.end, minutes: durationOf(f.start, f.end, f.minutes),
    title: f.title, cat: f.cat, prio: f.prio, check: f.check, deadline: !!f.deadline, notes: f.notes,
    series: !!a.repeat, moved: !!ov?.date && ov.date !== orig, done: plan.done[key], source: a.source,
  };
}

/** Toutes les occurrences entre deux dates (incluses), triées par jour puis par heure. */
export function expand(plan: Plan, from: ISODate, to: ISODate): Occ[] {
  const out: Occ[] = [];
  // exceptions qui DÉPLACENT une occurrence : indexées par série
  const moved = new Map<string, Array<[ISODate, Override]>>();
  for (const [k, ov] of Object.entries(plan.overrides)) {
    if (!ov.date || ov.deleted) continue;
    const { id, orig } = parseKey(k);
    if (!moved.has(id)) moved.set(id, []);
    moved.get(id)!.push([orig, ov]);
  }
  for (const a of plan.activities) {
    if (!a.repeat) {
      if (a.date >= from && a.date <= to && !plan.overrides[keyOf(a.id, ONCE)]?.deleted) out.push(makeOcc(plan, a, keyOf(a.id, ONCE), a.date));
      continue;
    }
    const lo = a.date > from ? a.date : from;
    const hi = a.repeat.until && a.repeat.until < to ? a.repeat.until : to;
    if (lo <= hi) {
      for (const d of range(lo, hi)) {
        if (!seriesHits(a, d)) continue;
        const key = keyOf(a.id, d);
        const ov = plan.overrides[key];
        if (ov?.deleted) continue;
        const date = ov?.date ?? d;
        if (date < from || date > to) continue; // déplacée hors de la période
        out.push(makeOcc(plan, a, key, d, ov));
      }
    }
    // occurrences d'origine hors période mais déplacées DANS la période
    for (const [orig, ov] of moved.get(a.id) ?? []) {
      if (orig >= from && orig <= to) continue; // déjà traitée
      if (ov.date! < from || ov.date! > to || !seriesHits(a, orig)) continue;
      out.push(makeOcc(plan, a, keyOf(a.id, orig), orig, ov));
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || (x.start ?? "99").localeCompare(y.start ?? "99") || x.title.localeCompare(y.title));
}

export const findOcc = (plan: Plan, key: string): Occ | undefined => {
  const { id, orig } = parseKey(key);
  const a = plan.activities.find((x) => x.id === id);
  if (!a) return undefined;
  if (!a.repeat) return plan.overrides[key]?.deleted ? undefined : makeOcc(plan, a, key, a.date);
  if (!seriesHits(a, orig) || plan.overrides[key]?.deleted) return undefined;
  return makeOcc(plan, a, key, orig, plan.overrides[key]);
};

/* ------------------------------------------------------------------ modifications (fonctions pures) */

const pick = (p: OccPatch): OccFields => {
  const o: OccFields = {};
  for (const k of ["title", "cat", "prio", "start", "end", "minutes", "notes", "check", "deadline"] as const) {
    if (k in p) (o as Record<string, unknown>)[k] = p[k];
  }
  return o;
};
const withoutKeys = <T,>(rec: Record<string, T>, test: (k: string) => boolean) =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => !test(k)));
const ofSeries = (id: string) => (k: string) => parseKey(k).id === id;

export function addActivity(plan: Plan, a: Activity): Plan {
  return { ...plan, activities: [...plan.activities, a] };
}

/** Réattribue les exceptions, validations et reports d'une série (à partir d'une date) à une autre série. */
function rekey(plan: Plan, fromId: string, toId: string, fromDate: ISODate): Pick<Plan, "overrides" | "done" | "postponed"> {
  const move = (k: string) => {
    const { id, orig } = parseKey(k);
    return id === fromId && orig >= fromDate ? keyOf(toId, orig) : k;
  };
  const remap = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [move(k), v]));
  return { overrides: remap(plan.overrides), done: remap(plan.done), postponed: plan.postponed.map((p) => ({ ...p, key: move(p.key) })) };
}

/**
 * Modifier une occurrence.
 * - `one` : seulement celle-ci (exception) ;
 * - `following` : celle-ci et toutes les suivantes (la série est coupée en deux, le passé ne bouge pas) ;
 * - `all` : toute la série.
 * `repeat` : un objet transforme en récurrente, `null` transforme en ponctuelle.
 */
export function editOccurrence(plan: Plan, key: string, patch: OccPatch, scope: Scope): Plan {
  const { id, orig } = parseKey(key);
  const a = plan.activities.find((x) => x.id === id);
  if (!a) return plan;
  const fields = pick(patch);
  const replace = (next: Activity) => plan.activities.map((x) => (x.id === id ? next : x));

  // --- ponctuelle
  if (!a.repeat) {
    if (patch.repeat) {
      // ponctuelle → récurrente : la validation éventuelle suit la date
      const date = patch.date ?? a.date;
      const next: Activity = { ...a, ...fields, date, repeat: patch.repeat, edited: true };
      const done = { ...plan.done };
      if (done[key]) { done[keyOf(id, date)] = done[key]; delete done[key]; }
      return { ...plan, activities: replace(next), done };
    }
    return { ...plan, activities: replace({ ...a, ...fields, date: patch.date ?? a.date, edited: true }) };
  }

  // --- série → ponctuelle
  if (patch.repeat === null) {
    const occ = findOcc(plan, key);
    if (!occ) return plan;
    const once: Activity = {
      id: uid(), title: occ.title, cat: occ.cat, prio: occ.prio, date: occ.date, start: occ.start, end: occ.end,
      minutes: occ.start ? undefined : occ.minutes, check: occ.check, deadline: occ.deadline, notes: occ.notes, source: "user",
      ...fields, ...(patch.date ? { date: patch.date } : {}),
    };
    let next = scope === "one" ? deleteOccurrence(plan, key, "one") : deleteOccurrence(plan, key, "following");
    next = addActivity(next, once);
    if (plan.done[key]) next = { ...next, done: { ...next.done, [keyOf(once.id, ONCE)]: plan.done[key] } };
    return next;
  }

  if (scope === "one") {
    const ov: Override = { ...(plan.overrides[key] ?? {}), ...fields };
    if (patch.date) ov.date = patch.date;
    return { ...plan, overrides: { ...plan.overrides, [key]: ov } };
  }

  const isFirst = orig <= a.date;
  if (scope === "all" || isFirst) {
    const repeat = patch.repeat ?? a.repeat;
    const next: Activity = { ...a, ...fields, repeat, edited: true };
    // nouvelle première date (changement de jour de début de série)
    if (patch.date && scope === "all" && patch.repeat) next.date = patch.date;
    // les champs modifiés pour toute la série remplacent ceux des exceptions
    const keys = Object.keys(fields);
    const overrides = Object.fromEntries(
      Object.entries(plan.overrides).map(([k, ov]) => {
        if (!ofSeries(id)(k) || !keys.length) return [k, ov];
        const o = { ...ov };
        for (const f of keys) delete (o as Record<string, unknown>)[f];
        return [k, o];
      }),
    );
    // un changement de date ne concerne que l'occurrence choisie (la série garde ses jours)
    if (patch.date && patch.date !== orig && !(scope === "all" && patch.repeat)) overrides[key] = { ...(overrides[key] ?? {}), date: patch.date };
    return { ...plan, activities: replace(next), overrides };
  }

  // "following" : on coupe la série à `orig`
  const newId = uid();
  const old: Activity = { ...a, repeat: { ...a.repeat, until: addDays(orig, -1) } };
  const repeat = patch.repeat ?? a.repeat;
  const fresh: Activity = { ...a, ...fields, id: newId, date: orig, repeat: { ...repeat, until: a.repeat.until }, edited: true };
  const moved = rekey(plan, id, newId, orig);
  // les champs modifiés remplacent ceux des exceptions futures
  const keys = Object.keys(fields);
  const overrides = Object.fromEntries(
    Object.entries(moved.overrides).map(([k, ov]) => {
      if (!ofSeries(newId)(k) || !keys.length) return [k, ov];
      const o = { ...ov };
      for (const f of keys) delete (o as Record<string, unknown>)[f];
      return [k, o];
    }),
  );
  if (patch.date && patch.date !== orig) overrides[keyOf(newId, orig)] = { ...(overrides[keyOf(newId, orig)] ?? {}), date: patch.date };
  return { ...plan, ...moved, overrides, activities: [...replace(old), fresh] };
}

/** Supprimer une occurrence, les suivantes ou toute la série. */
export function deleteOccurrence(plan: Plan, key: string, scope: Scope): Plan {
  const { id, orig } = parseKey(key);
  const a = plan.activities.find((x) => x.id === id);
  if (!a) return plan;
  const dropAll = (): Plan => ({
    ...plan,
    activities: plan.activities.filter((x) => x.id !== id),
    overrides: withoutKeys(plan.overrides, ofSeries(id)),
    done: withoutKeys(plan.done, ofSeries(id)),
    postponed: plan.postponed.filter((p) => !ofSeries(id)(p.key)),
  });
  // élément importé (agenda, import du soir) : on garde une trace de la suppression, sinon l'import suivant le recréerait
  if (!a.repeat && (a.source === "gcal" || a.source === "inbox")) {
    const done = { ...plan.done };
    delete done[key];
    return { ...plan, overrides: { ...plan.overrides, [key]: { deleted: true } }, done };
  }
  if (!a.repeat || scope === "all") return dropAll();
  if (scope === "one") {
    const done = { ...plan.done };
    delete done[key];
    return { ...plan, overrides: { ...plan.overrides, [key]: { deleted: true } }, done };
  }
  if (orig <= a.date) return dropAll();
  const later = (k: string) => {
    const p = parseKey(k);
    return p.id === id && p.orig >= orig;
  };
  return {
    ...plan,
    activities: plan.activities.map((x) => (x.id === id ? { ...x, repeat: { ...x.repeat!, until: addDays(orig, -1) } } : x)),
    overrides: withoutKeys(plan.overrides, later),
    done: withoutKeys(plan.done, later),
  };
}

/** Déplacer UNE occurrence (glisser-déposer) en gardant sa durée. */
export function moveOccurrence(plan: Plan, key: string, date: ISODate, start?: string): Plan {
  const occ = findOcc(plan, key);
  if (!occ) return plan;
  const patch: OccPatch = { date };
  if (start && occ.start && occ.end) {
    const dur = occ.minutes;
    const s = toMin(start);
    patch.start = start;
    patch.end = `${String(Math.floor(((s + dur) % 1440) / 60)).padStart(2, "0")}:${String((s + dur) % 60).padStart(2, "0")}`;
  }
  return editOccurrence(plan, key, patch, "one");
}

/** Cocher / décocher. La durée retenue est celle de la séance (modifiable). */
export function toggleDone(plan: Plan, key: string, minutes?: number, at = new Date().toISOString()): Plan {
  const done = { ...plan.done };
  if (done[key]) delete done[key];
  else {
    const occ = findOcc(plan, key);
    if (!occ) return plan;
    done[key] = { at, minutes: minutes ?? occ.minutes };
  }
  return { ...plan, done };
}

/** Valider une séance avec la durée réellement faite (mode Focus). */
export function markDone(plan: Plan, key: string, minutes: number, extra: Partial<Done> = {}, at = new Date().toISOString()): Plan {
  if (!findOcc(plan, key)) return plan;
  return { ...plan, done: { ...plan.done, [key]: { at, minutes: Math.max(1, Math.round(minutes)), ...extra } } };
}

/** Reporter une occurrence non faite à une autre date (jamais automatique). */
export function postpone(plan: Plan, key: string, to: ISODate, at = new Date().toISOString()): Plan {
  const occ = findOcc(plan, key);
  if (!occ || occ.date === to) return plan;
  const next = editOccurrence(plan, key, { date: to }, "one");
  const done = { ...next.done };
  delete done[key];
  return { ...next, done, postponed: [...plan.postponed, { key, from: occ.date, to, at }] };
}

/** Occurrences à cocher passées et non faites (à reporter, valider ou supprimer). */
export function overdue(plan: Plan, today: ISODate, days = 14): Occ[] {
  return expand(plan, addDays(today, -days), addDays(today, -1)).filter((o) => o.check && !o.done);
}

/** Import d'événements externes (Google Agenda) : ajout ou mise à jour, sans écraser une modification manuelle. */
export function upsertExternal(plan: Plan, items: Activity[]): Plan {
  const acts = [...plan.activities];
  for (const it of items) {
    const i = acts.findIndex((x) => x.id === it.id);
    if (i < 0) acts.push(it);
    else if (!acts[i].edited) acts[i] = { ...acts[i], ...it };
  }
  return { ...plan, activities: acts };
}

/* ------------------------------------------------------------------ objectifs */

export function goalValue(plan: Plan, g: Goal, from: ISODate, to: ISODate): number {
  if (g.unit === "€" || g.manual !== undefined) return g.manual ?? 0;
  const occs = expand(plan, from, to).filter((o) => o.done && (!g.cat || o.cat === g.cat));
  return g.unit === "h" ? occs.reduce((s, o) => s + o.done!.minutes, 0) / 60 : occs.length;
}

/** Objectif rapporté à une période : un objectif hebdo vaut ×(jours/7) sur un mois. */
export const goalTarget = (g: Goal, days: number) =>
  g.period === "semaine" ? Math.round(g.target * (days / 7) * 10) / 10 : g.period === "mois" ? Math.round(g.target * (days / 30.4) * 10) / 10 : g.target;

/* ------------------------------------------------------------------ replanifier la journée */

export type Replan = { plan: Plan; moves: Array<{ key: string; title: string; from: string; to: string }>; overflow: Occ[] };

/**
 * Recale la journée à partir de maintenant.
 * - Les séances encore à venir gardent leur créneau (le planning tient debout).
 * - Les séances manquées et non faites se glissent dans les trous libres, l'important d'abord, sans chevaucher
 *   cours, repas, khôlles, temps libre ni la routine du soir, avec `gap` minutes de respiration (comme la pause Focus).
 * - S'il manque de la place pour une séance importante, une séance facultative à venir lui cède son créneau.
 * - Ce qui ne rentre pas avant `endMin` est rendu à part (à reporter à demain, jamais automatiquement).
 */
export function replanDay(plan: Plan, date: ISODate, fromMinute: number, endMin = 22 * 60 + 30, gap = 5): Replan {
  const occs = expand(plan, date, date).filter((o) => o.start);
  const isTask = (o: Occ) => o.check && !o.done && o.cat !== "lecture";
  const start0 = Math.ceil(fromMinute / 5) * 5;
  const fixed = occs.filter((o) => !isTask(o)).map((o) => [toMin(o.start!), toMin(o.start!) + o.minutes] as const);
  let future = occs.filter((o) => isTask(o) && toMin(o.start!) >= start0);
  const missed = occs.filter((o) => isTask(o) && toMin(o.start!) < start0)
    .sort((a, b) => Number(a.prio === "facultatif") - Number(b.prio === "facultatif") || toMin(a.start!) - toMin(b.start!));

  const place = (fut: Occ[]) => {
    const busy: Array<readonly [number, number]> = [...fixed, ...fut.map((o) => [toMin(o.start!), toMin(o.start!) + o.minutes] as const)];
    const placed: Array<{ o: Occ; s: number }> = [];
    const over: Occ[] = [];
    for (const o of missed) {
      let s = start0;
      for (let guard = 0; guard < 80; guard++) {
        const hit = busy.find(([a, b]) => s < b + gap && s + o.minutes + gap > a);
        if (!hit) break;
        s = Math.ceil((hit[1] + gap) / 5) * 5;
      }
      if (s + o.minutes > endMin) { over.push(o); continue; }
      placed.push({ o, s });
      busy.push([s, s + o.minutes]);
    }
    return { placed, over };
  };

  let res = place(future);
  const freed: Occ[] = [];
  while (res.over.some((o) => o.prio !== "facultatif") && future.some((o) => o.prio === "facultatif")) {
    const last = [...future].sort((a, b) => toMin(b.start!) - toMin(a.start!)).find((o) => o.prio === "facultatif")!;
    future = future.filter((o) => o !== last);
    freed.push(last);
    res = place(future);
  }
  let next = plan;
  const moves: Replan["moves"] = [];
  for (const { o, s } of res.placed.sort((a, b) => a.s - b.s)) {
    const to = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    if (to === o.start) continue;
    next = moveOccurrence(next, o.key, date, to);
    moves.push({ key: o.key, title: o.title, from: o.start!, to });
  }
  const overflow = [...res.over, ...freed].sort((a, b) => toMin(a.start!) - toMin(b.start!));
  return { plan: next, moves, overflow };
}
