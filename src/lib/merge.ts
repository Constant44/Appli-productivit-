/**
 * Fusion de deux versions du planning (cet appareil + le compte), pour qu'une modification faite sur un
 * appareil ne soit jamais écrasée par un autre : on additionne au lieu de remplacer.
 * En cas de conflit sur un même élément, la version de cet appareil (la plus récente pour l'utilisateur) gagne.
 */
import type { Plan } from "./model";
import type { QuizStats } from "./store";

type Rec = Record<string, unknown>;
const mergeMap = <T extends Rec>(remote: T | undefined, local: T | undefined): T => ({ ...(remote ?? {}), ...(local ?? {}) }) as T;

function mergeById<T>(remote: T[] | undefined, local: T[] | undefined, key: (x: T) => string): T[] {
  const out = new Map<string, T>();
  for (const x of remote ?? []) out.set(key(x), x);
  for (const x of local ?? []) out.set(key(x), x);
  return [...out.values()];
}

export function mergePlans(local: Plan, remote: Plan): Plan {
  return {
    ...local,
    categories: mergeById(remote.categories, local.categories, (c) => c.id),
    activities: mergeById(remote.activities, local.activities, (a) => a.id),
    goals: mergeById(remote.goals, local.goals, (g) => g.id),
    overrides: mergeMap(remote.overrides, local.overrides),
    done: mergeMap(remote.done, local.done),
    sleep: Object.fromEntries(
      [...new Set([...Object.keys(remote.sleep ?? {}), ...Object.keys(local.sleep ?? {})])].map((d) => [d, { ...(remote.sleep?.[d] ?? {}), ...(local.sleep?.[d] ?? {}) }]),
    ),
    routineLog: Object.fromEntries(
      [...new Set([...Object.keys(remote.routineLog ?? {}), ...Object.keys(local.routineLog ?? {})])].map((d) => {
        const r = remote.routineLog?.[d] ?? {};
        const l = local.routineLog?.[d] ?? {};
        return [d, { ...r, ...l, matin: [...new Set([...(r.matin ?? []), ...(l.matin ?? [])])], soir: [...new Set([...(r.soir ?? []), ...(l.soir ?? [])])] }];
      }),
    ),
    postponed: mergeById(remote.postponed, local.postponed, (p) => `${p.key}|${p.to}|${p.at}`),
    reviews: mergeMap(remote.reviews as Rec, local.reviews as Rec),
    copies: mergeById(remote.copies, local.copies, (c) => c.id),
    run: { ...remote.run, ...local.run, log: mergeById(remote.run?.log, local.run?.log, (l) => l.id) },
    patched: [...new Set([...(remote.patched ?? []), ...(local.patched ?? [])])],
    todos: mergeById(remote.todos, local.todos, (t) => t.id),
  };
}

export function mergeQuiz(local: QuizStats, remote: QuizStats): QuizStats {
  const out: QuizStats = { ...remote };
  for (const [k, v] of Object.entries(local)) {
    const r = remote[k];
    out[k] = !r || v.last >= r.last ? v : r;
  }
  return out;
}
