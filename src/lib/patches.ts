/**
 * Mises à jour du planning préparées par Claude (document privé inbox-plan), appliquées une seule fois
 * par l'appli, puis synchronisées comme n'importe quelle modification (et annulables).
 */
import type { ISODate } from "./dates";
import { deleteOccurrence, editOccurrence, expand, findOcc, type Activity, type DaySleep, type OccPatch, type Plan } from "./model";
import { applySchedule } from "./routine";
import type { Routines } from "./routineDefaults";

/**
 * - add : ajoute une activité (ponctuelle ou série) ; remplace celle qui a le même id
 * - delete : supprime une occurrence
 * - edit : modifie une occurrence (cette occurrence seulement)
 * - clearDay : libère une journée (supprime les séances à cocher non faites, sauf celles gardées)
 * - routines : remplace les étapes des routines du matin et du soir
 * - schedule : nouveaux horaires de lever / extinction à partir d'une date
 */
export type PlanOp =
  | { op: "add"; activity: Activity }
  | { op: "delete"; key: string }
  | { op: "edit"; key: string; patch: OccPatch }
  | { op: "clearDay"; date: ISODate; keepIds?: string[]; keepCats?: string[] }
  | { op: "routines"; routines: Routines }
  | { op: "schedule"; schedule: DaySleep[]; from: ISODate };
export type PlanPatch = { id: string; note?: string; ops: PlanOp[] };

const KEEP_ON_CLEAR = ["vie", "lecture", "course", "sport", "libre", "cours", "eval"];
const idOf = (key: string) => key.slice(0, key.lastIndexOf("@"));

export function applyOps(plan: Plan, ops: PlanOp[]): Plan {
  let p = plan;
  for (const o of ops) {
    if (o.op === "add") {
      const a = { ...o.activity, source: o.activity.source ?? "inbox" } as Activity;
      p = { ...p, activities: [...p.activities.filter((x) => x.id !== a.id), a] };
    } else if (o.op === "delete") {
      if (findOcc(p, o.key)) p = deleteOccurrence(p, o.key, "one");
    } else if (o.op === "edit") {
      if (findOcc(p, o.key)) p = editOccurrence(p, o.key, o.patch, "one");
    } else if (o.op === "clearDay") {
      const keepCats = new Set([...KEEP_ON_CLEAR, ...(o.keepCats ?? [])]);
      const keepIds = new Set(o.keepIds ?? []);
      for (const occ of expand(p, o.date, o.date)) {
        if (!occ.check || occ.done || keepCats.has(occ.cat) || keepIds.has(idOf(occ.key))) continue;
        p = deleteOccurrence(p, occ.key, "one");
      }
    } else if (o.op === "routines") {
      if (o.routines?.matin?.length && o.routines?.soir?.length) p = { ...p, routines: o.routines };
    } else if (o.op === "schedule") {
      if (o.schedule?.length === 7) p = applySchedule(p, o.schedule, o.from);
    }
  }
  return p;
}

/** Appliquer les mises à jour pas encore vues ; renvoie aussi leurs notes (pour le message à l'écran). */
export function applyPatches(plan: Plan, patches: PlanPatch[]): { plan: Plan; notes: string[] } {
  const seen = new Set(plan.patched ?? []);
  let p = plan;
  const notes: string[] = [];
  let applied = 0;
  for (const x of patches) {
    if (!x?.id || seen.has(x.id) || !Array.isArray(x.ops)) continue;
    p = applyOps(p, x.ops);
    seen.add(x.id);
    applied++;
    if (x.note) notes.push(x.note);
  }
  return { plan: applied ? { ...p, patched: [...seen] } : plan, notes };
}
