/**
 * Sauvegarde dans ton compte claude.ai (base `db`, dossier privé data/users/<toi>/) :
 * les mêmes données sur le Mac, l'iPad et le téléphone.
 *
 * - Le plan est réparti en quelques documents (limite de 256 Kio chacun) : p2-plan, p2-ex, p2-done, p2-reviews, p2-quiz.
 * - p2-meta garde la date de la dernière sauvegarde : au chargement (et au retour sur l'appli), la version la plus
 *   récente gagne, appareil ou compte.
 * - Boîte de réception : l'import du soir (Claude) y dépose l'actu, les mots et persos du prof (collection `inbox`)
 *   et les khôlles / DS de ton Google Agenda (document privé inbox-agenda).
 */
import seed from "../data/seed.json";
import { normalize, upsertExternal, type Activity, type Plan } from "./model";
import { applyPatches, type PlanPatch } from "./patches";
import { mergePlans, mergeQuiz } from "./merge";
import type { Copy, Grade } from "./grades";
import { freezeReviews, useStore, type Content, type QCard, type QSheet, type QuizStats } from "./store";

import { capability, runtime } from "./runtime";

/* eslint-disable @typescript-eslint/no-explicit-any */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const device = Math.random().toString(36).slice(2, 8);

type Parts = Record<string, Record<string, unknown>>;
const split = (plan: Plan, quiz: QuizStats): Parts => ({
  "p2-plan": { categories: plan.categories, activities: plan.activities, goals: plan.goals, prefs: plan.prefs, routines: plan.routines },
  "p2-ex": { overrides: plan.overrides, postponed: plan.postponed, patched: plan.patched ?? [] },
  "p2-done": { done: plan.done, sleep: plan.sleep, routineLog: plan.routineLog, run: plan.run },
  "p2-reviews": { reviews: plan.reviews },
  "p2-copies": { copies: plan.copies },
  "p2-quiz": { quiz },
});

let db: any = null;
let root = "";
const lastSent: Record<string, string> = {};
let timer: ReturnType<typeof setTimeout> | null = null;
let applying = false;
/** on n'envoie jamais rien tant que la sauvegarde du compte n'a pas été lue (sinon un appareil neuf l'écraserait) */
let pulled = false;

export async function startCloud() {
  if (!runtime()) {
    useStore.setState({ cloud: { status: "local", msg: "Ouverte hors de claude.ai : données gardées sur cet appareil." } });
    freezeReviews();
    void loadContent(null);
    return;
  }
  useStore.setState({ cloud: { status: "sync" } });
  const [d, user] = await Promise.all([capability("db"), capability("user")]);
  const id: string | null = user ? await user.id().catch(() => null) : null;
  if (!d || !id) {
    useStore.setState({ cloud: { status: "local", msg: "Sauvegarde en ligne indisponible : ouvre l'appli depuis claude.ai, connecté à ton compte." } });
    freezeReviews();
    void loadContent(null);
    return;
  }
  db = d;
  root = `data/users/${id}`;
  const firstPull = async () => {
    try {
      await pull(true);
    } catch {
      useStore.setState({ cloud: { status: "error", msg: "Lecture de la sauvegarde impossible pour l'instant : nouvel essai dans 15 s. Tes données restent sur cet appareil." } });
      setTimeout(() => void firstPull(), 15000);
    }
  };
  await firstPull();
  useStore.subscribe((s, prev) => {
    if (applying || (s.plan === prev.plan && s.quiz === prev.quiz)) return;
    schedule();
  });
  freezeReviews(); // après la lecture du compte : on fige les semaines terminées des VRAIES données (puis envoi)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !timer) void pull(false).catch(() => {}).then(() => checkPlanInbox());
  });
  void loadContent(id);
  void checkPlanInbox();
  // Claude peut préparer un nouveau programme pendant que l'appli est ouverte : on regarde toutes les 2 min
  setInterval(() => { if (document.visibilityState === "visible") void checkPlanInbox(); }, 120000);
  // un autre appareil a peut-être écrit : on regarde toutes les 30 s (une seule petite lecture)
  setInterval(() => { if (document.visibilityState === "visible" && !timer) void pull(false).catch(() => {}); }, 30000);
  window.addEventListener("focus", () => { if (!timer) void pull(false).catch(() => {}); });
}

/** Mises à jour du planning préparées par Claude (document privé inbox-plan). */
async function checkPlanInbox() {
  if (!db || !pulled) return;
  try {
    const d = await db.doc(`${root}/inbox-plan`).get();
    if (!d.exists) return;
    const patches = (d.data() as { patches?: PlanPatch[] }).patches ?? [];
    const pending = patches.filter((x) => x?.id && !(useStore.getState().plan.patched ?? []).includes(x.id));
    if (!pending.length) return;
    let notes: string[] = [];
    useStore.getState().apply((p) => {
      const r = applyPatches(p, clone(pending));
      notes = r.notes;
      return r.plan;
    }, "Planning mis à jour par Claude");
    if (notes.length) useStore.getState().toast?.(notes.join(" · "));
  } catch {
    /* rien de neuf */
  }
}

/* ------------------------------------------------------------------ synchronisation entre appareils
 * syncedAt = date de la version du compte avec laquelle cet appareil est à jour (gardée sur l'appareil).
 * - le compte n'a pas bougé depuis : j'envoie mes modifications s'il y en a ;
 * - le compte a bougé et je n'ai rien modifié : je prends la version du compte ;
 * - les deux ont bougé : je FUSIONNE (rien n'est perdu), puis j'envoie le résultat.
 * Avant chaque envoi, je revérifie le compte : un autre appareil a pu écrire entre-temps. */
const SYNC_KEY = "cadence-synced";
let syncedAt = (() => {
  try {
    return Number(localStorage.getItem(SYNC_KEY)) || 0;
  } catch {
    return 0;
  }
})();
const setSynced = (at: number) => {
  syncedAt = at;
  try {
    localStorage.setItem(SYNC_KEY, String(at));
  } catch {
    /* stockage indisponible */
  }
};

async function readRemote(): Promise<{ plan: Plan; quiz: QuizStats } | null> {
  const parts = await Promise.all(["p2-plan", "p2-ex", "p2-done", "p2-reviews", "p2-quiz", "p2-copies"].map((k) => db.doc(`${root}/${k}`).get()));
  const [pl, ex, dn, rv, qz, cp] = parts.map((p: any) => (p.exists ? clone(p.data()) : {}));
  if (!pl.activities) return null;
  const plan: Plan = normalize({
    v: 2, categories: pl.categories, activities: pl.activities, goals: pl.goals ?? [], prefs: pl.prefs,
    overrides: ex.overrides ?? {}, postponed: ex.postponed ?? [], done: dn.done ?? {}, sleep: dn.sleep ?? {}, reviews: rv.reviews ?? {},
    copies: cp.copies ?? [], routines: pl.routines, routineLog: dn.routineLog ?? {}, run: dn.run, patched: ex.patched ?? [],
  });
  return { plan, quiz: qz.quiz ?? {} };
}

let pulling: Promise<void> | null = null;
function pull(first: boolean): Promise<void> {
  if (!pulling) pulling = doPull(first).finally(() => { pulling = null; });
  return pulling;
}

async function doPull(first: boolean) {
  const meta = await db.doc(`${root}/p2-meta`).get();
  const remoteAt: number = meta.exists ? (meta.data() as { savedAt: number }).savedAt : 0;
  const local = useStore.getState();
  const localChanged = local.savedAt > syncedAt;
  if (meta.exists && remoteAt > syncedAt) {
    const remote = await readRemote();
    if (remote) {
      const now = useStore.getState(); // l'utilisateur a pu modifier pendant la lecture
      const changed = now.savedAt > syncedAt;
      const plan = changed ? mergePlans(now.plan, remote.plan) : remote.plan;
      const quiz = changed ? mergeQuiz(now.quiz, remote.quiz) : remote.quiz;
      applying = true;
      useStore.getState().setPlan(plan, changed ? Date.now() : remoteAt, quiz);
      applying = false;
      // ce que le compte contient déjà : on n'enverra que ce qui diffère
      for (const [k, v] of Object.entries(split(remote.plan, remote.quiz))) lastSent[k] = JSON.stringify(v);
      setSynced(remoteAt);
      pulled = true;
      if (changed) {
        schedule(300);
        if (!first) useStore.getState().toast("Modifications d'un autre appareil fusionnées avec celles-ci", { tone: "info" });
      }
      useStore.setState({ cloud: { status: "ok", at: Date.now() } });
      return;
    }
  }
  pulled = true;
  if (!meta.exists || localChanged) schedule(first ? 50 : 300); // compte vide, ou modifications pas encore envoyées
  useStore.setState({ cloud: { status: "ok", at: Date.now() } });
}

function schedule(ms = 1200) {
  if (!pulled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void push(), ms);
}

async function push() {
  timer = null;
  useStore.setState({ cloud: { status: "sync" } });
  try {
    // un autre appareil a écrit depuis ma dernière synchro ? je fusionne d'abord (la fusion relance l'envoi)
    const meta = await db.doc(`${root}/p2-meta`).get();
    const remoteAt: number = meta.exists ? (meta.data() as { savedAt: number }).savedAt : 0;
    if (meta.exists && remoteAt > syncedAt) {
      await pull(false);
      return;
    }
    const { plan, quiz, savedAt } = useStore.getState();
    const stamp = Math.max(savedAt, remoteAt + 1, Date.now());
    for (const [k, v] of Object.entries(split(plan, quiz))) {
      const s = JSON.stringify(v);
      if (lastSent[k] === s) continue;
      await db.doc(`${root}/${k}`).set({ ...JSON.parse(s), savedAt: stamp });
      lastSent[k] = s;
    }
    await db.doc(`${root}/p2-meta`).set({ savedAt: stamp, device });
    setSynced(stamp);
    // si rien n'a bougé pendant l'envoi, l'appareil est à jour avec le compte
    if (useStore.getState().savedAt === savedAt) {
      applying = true;
      useStore.setState({ savedAt: stamp });
      applying = false;
    } else schedule();
    useStore.setState({ cloud: { status: "ok", at: Date.now() } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    useStore.setState({ cloud: { status: "error", msg: `Sauvegarde en ligne en attente (${code ?? "erreur"}). Tes données sont gardées sur cet appareil, nouvel essai dans 20 s.` } });
    schedule(20000);
  }
}

/* ------------------------------------------------------------------ contenu du test du vendredi + agenda */

const FALLEN_BEFORE = ["M54", "M58", "M61", "M62", "M63", "P26", "P28", "P30"];

async function loadContent(id: string | null) {
  const s = seed as { sheets: QSheet[]; cards: QCard[] };
  const cards = new Map<string, QCard>();
  const sheets = new Map<string, QSheet>();
  for (const c of s.cards) if (c.deck === "mot" || c.deck === "bio") cards.set(c.id, c);
  for (const x of s.sheets) sheets.set(x.id, x);
  const fallen = new Set(FALLEN_BEFORE);
  const unfallen = new Set<string>();
  const actuDays = new Map<string, { id: string; title: string }>();
  let grades: Grade[] | undefined;
  let gradesAt: string | undefined;
  if (db && id) {
    try {
      const inbox = await db.collection("inbox").limit(1000).get();
      for (const d of inbox.docs) {
        const p = d.data() as { cards?: QCard[]; sheets?: QSheet[]; fallen?: string[]; unfallen?: string[]; actuDays?: Array<{ id: string; title: string }> };
        for (const c of p.cards ?? []) if (c.deck === "mot" || c.deck === "bio" || c.deck === "actu") cards.set(c.id, clone(c));
        for (const x of p.sheets ?? []) sheets.set(x.id, clone(x));
        for (const f of p.fallen ?? []) fallen.add(f);
        for (const f of p.unfallen ?? []) unfallen.add(f);
        for (const a of p.actuDays ?? []) actuDays.set(a.id, a);
      }
    } catch {
      /* hors ligne : on garde le cache */
    }
    try {
      const gr = await db.doc(`data/users/${id}/inbox-grades`).get();
      if (gr.exists) {
        const d = clone(gr.data()) as { grades?: Grade[]; updatedAt?: string };
        grades = d.grades ?? [];
        gradesAt = d.updatedAt;
      }
    } catch {
      /* notes indisponibles : on garde le cache */
    }
    try {
      const cp = await db.doc(`data/users/${id}/inbox-copies`).get();
      const incoming = cp.exists ? ((cp.data() as { copies?: Copy[] }).copies ?? []) : [];
      if (incoming.length) useStore.getState().apply((p) => {
        const have = new Set(p.copies.map((c) => c.id));
        const fresh = incoming.filter((c) => !have.has(c.id));
        return fresh.length ? { ...p, copies: [...p.copies, ...clone(fresh)] } : p;
      });
    } catch {
      /* rien */
    }
    try {
      const ag = await db.doc(`data/users/${id}/inbox-agenda`).get();
      if (ag.exists) {
        const items = (ag.data() as { items?: Activity[] }).items ?? [];
        if (items.length) useStore.getState().apply((p) => {
          const next = upsertExternal(p, clone(items));
          return JSON.stringify(next.activities) === JSON.stringify(p.activities) ? p : next;
        });
      }
    } catch {
      /* agenda indisponible */
    }
  }
  const cached = useStore.getState().content;
  if (!db) {
    for (const c of cached.cards) cards.set(c.id, c);
    for (const x of cached.sheets) sheets.set(x.id, x);
    for (const f of cached.fallen) fallen.add(f);
  }
  for (const f of unfallen) fallen.delete(f);
  const content: Content = {
    cards: [...cards.values()], sheets: [...sheets.values()], fallen: [...fallen], actuDays: [...actuDays.values()],
    grades: grades ?? cached.grades ?? [], gradesAt: gradesAt ?? cached.gradesAt,
  };
  useStore.getState().setContent(content);
}

/** Marquer un mot / perso comme tombé au test (il sort des révisions). Enregistré dans le compte. */
export async function toggleFallen(ref: string) {
  const c = useStore.getState().content;
  const fallen = c.fallen.includes(ref) ? c.fallen.filter((x) => x !== ref) : [...c.fallen, ref];
  useStore.getState().setContent({ ...c, fallen });
  if (db) {
    try {
      const on = fallen.includes(ref);
      await db.doc(`inbox/tombes-app-${ref}`).set({ fallen: on ? [ref] : [], unfallen: on ? [] : [ref] });
    } catch {
      /* gardé sur l'appareil */
    }
  }
}
