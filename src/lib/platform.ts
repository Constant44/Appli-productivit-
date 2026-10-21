/**
 * Intégration avec l'hébergement claude.ai (version iPad / téléphone).
 *
 * Quand l'appli est ouverte comme Artifact claude.ai, `window.claude.use()` donne accès à :
 *  - `db`   : une base privée par utilisateur → les données suivent ton compte (iPad, téléphone, ordi) ;
 *  - `user` : ton identifiant, pour le chemin privé `data/users/<id>/…` ;
 *  - `downloads` : enregistrer un fichier (export de sauvegarde).
 * Hors claude.ai (npm run dev / npm start), tout cela est absent et l'appli reste en localStorage.
 */
import { create } from "zustand";
import { applyEmbeddedPacks, onlyDefinitions, useStore } from "./store";
import type { ContentPack } from "./types";
import { uid } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClaudeRuntime = { use: (name: string) => Promise<any> };
const runtime = (): ClaudeRuntime | undefined => (window as any).claude;

export async function capability(name: string): Promise<any | null> {
  try {
    return (await runtime()?.use(name)) ?? null;
  } catch {
    return null;
  }
}

/** Clés de l'état synchronisées. Les tableaux sont découpés en morceaux (limite de 256 Kio par document). */
const SYNC_KEYS = [
  "tasks", "evals", "sessions", "plans", "grades", "lessons", "customEvents", "pronote", "club", "xp", "coins", "settings", "timer",
  "sheets", "cards", "actuDays", "reviews", "inboxDone", "cgTests", "edhec", "warmups", "fallen",
] as const;
type SyncKey = (typeof SYNC_KEYS)[number];
const CHUNK = 400;

export type CloudStatus = "local" | "connecting" | "synced" | "saving" | "waiting" | "error";
export const useCloud = create<{ status: CloudStatus; message?: string }>(() => ({ status: "local" }));

const deviceId = uid();

/**
 * Clés modifiées sur cet appareil et pas encore enregistrées en ligne. Gardées d'une ouverture à l'autre :
 * si l'appli est fermée avant la fin de la sauvegarde, la version de l'appareil l'emporte au prochain chargement
 * (sinon l'ancienne sauvegarde en ligne écraserait ces changements).
 */
const PENDING_KEY = "prepa-fc-sync-pending";
const readPending = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
};
class PendingSet<T extends string> extends Set<T> {
  private save() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify([...this]));
    } catch {
      /* stockage indisponible : on fait sans */
    }
  }
  add(k: T) {
    super.add(k);
    this.save();
    return this;
  }
  delete(k: T) {
    const r = super.delete(k);
    this.save();
    return r;
  }
}

export async function startCloudSync() {
  if (!runtime()) return; // pas dans claude.ai
  useCloud.setState({ status: "connecting" });
  const [db, user] = await Promise.all([capability("db"), capability("user")]);
  const id: string | null = user ? await user.id().catch(() => null) : null;
  if (!db || !id) {
    applyEmbeddedPacks();
    useCloud.setState({ status: "local", message: "Sauvegarde en ligne indisponible : données gardées sur cet appareil." });
    return;
  }
  const root = `data/users/${id}`;
  const metaRef = db.doc(`${root}/meta`);
  let chunks: Partial<Record<SyncKey, number>> = {};
  let lastWriteStamp = "";

  /**
   * Après un chargement : nettoyage des données d'une version plus ancienne et packs embarqués pas encore fusionnés.
   * Appelé une fois l'abonnement en place, pour que le résultat soit réenregistré dans le compte.
   */
  const repair = () => {
    const st = useStore.getState();
    if (st.cards.some((c) => c.deck === "mot" && !c.id.endsWith("-def"))) useStore.setState(onlyDefinitions(st));
    applyEmbeddedPacks();
  };

  /** Clés non enregistrées lors de la dernière ouverture : on garde celles de l'appareil. */
  const keepLocal = new Set(readPending().filter((k): k is SyncKey => (SYNC_KEYS as readonly string[]).includes(k)));

  const loadRemote = async () => {
    const meta = await metaRef.get();
    if (!meta.exists) return false;
    const m = meta.data() as { chunks: Partial<Record<SyncKey, number>>; stamp: string };
    m.chunks = { ...(m.chunks ?? {}) };
    const patch: Record<string, unknown> = {};
    for (const key of SYNC_KEYS) {
      if (keepLocal.has(key)) continue;
      // Clé absente de l'index (index pas réécrit après une sauvegarde interrompue) : on cherche quand même le document.
      if (m.chunks[key] === undefined) {
        if ((await db.doc(`${root}/${key}-0`).get()).exists) m.chunks[key] = 1;
        else if ((await db.doc(`${root}/${key}`).get()).exists) m.chunks[key] = 0;
      }
      const n = m.chunks[key];
      if (n === undefined) continue;
      if (n === 0) {
        const snap = await db.doc(`${root}/${key}`).get();
        if (snap.exists) {
          patch[key] = (snap.data() as { v: unknown }).v;
          written.set(`${root}/${key}`, JSON.stringify(snap.data()));
        }
      } else {
        const parts: unknown[] = [];
        let found = false;
        for (let i = 0; i < n; i++) {
          const snap = await db.doc(`${root}/${key}-${i}`).get();
          if (snap.exists) {
            found = true;
            parts.push(...((snap.data() as { v: unknown[] }).v ?? []));
            written.set(`${root}/${key}-${i}`, JSON.stringify(snap.data()));
          }
        }
        // Index en avance sur les documents (écriture interrompue) : on garde la version de l'appareil.
        if (found) patch[key] = parts;
      }
    }
    chunks = m.chunks;
    lastWriteStamp = m.stamp;
    applying = true;
    useStore.setState(patch as never);
    applying = false;
    return true;
  };

  /** Dernier contenu enregistré par document : on ne réécrit jamais un document identique. */
  const written = new Map<string, string>();
  const writeDoc = async (path: string, body: Record<string, unknown>) => {
    const json = JSON.stringify(body);
    if (written.get(path) === json) return false;
    await db.doc(path).set(body);
    written.set(path, json);
    // Le service limite le débit d'écriture : on attend plus longtemps après un gros document.
    await new Promise((r) => setTimeout(r, 300 + Math.round(json.length / 40)));
    return true;
  };

  const writeKey = async (key: SyncKey, value: unknown) => {
    let wrote = false;
    if (Array.isArray(value)) {
      const n = Math.max(1, Math.ceil(value.length / CHUNK));
      for (let i = 0; i < n; i++) wrote = (await writeDoc(`${root}/${key}-${i}`, { v: value.slice(i * CHUNK, (i + 1) * CHUNK) })) || wrote;
      for (let i = n; i < (chunks[key] ?? 0); i++) {
        await db.doc(`${root}/${key}-${i}`).delete();
        written.delete(`${root}/${key}-${i}`);
        wrote = true;
      }
      chunks[key] = n;
    } else {
      wrote = await writeDoc(`${root}/${key}`, { v: value ?? null });
      chunks[key] = 0;
    }
    return wrote;
  };

  let applying = false;
  const dirty = new PendingSet<SyncKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;
  /** Délai d'attente après un refus (0 = tout va bien). Double à chaque échec, jusqu'à 5 min. */
  let backoff = 0;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  /** Index des documents : réécrit après chaque clé enregistrée, pour que rien ne soit à refaire si l'appli est fermée en cours de route. */
  const writeMeta = async () => {
    const stamp = `${deviceId}:${Date.now()}`;
    await writeDoc(`${root}/meta`, { chunks, stamp });
    lastWriteStamp = stamp; // seulement une fois l'écriture réussie
  };

  const flush = async () => {
    if (writing || !dirty.size) return;
    writing = true;
    useCloud.setState({ status: "saving" });
    let current: SyncKey | undefined;
    try {
      const s = useStore.getState();
      // Les petits documents d'abord (DS, notes, cours…) : ce sont eux qui comptent le plus et coûtent le moins.
      const keys = [...dirty].sort((a, b) => JSON.stringify(s[a] ?? null).length - JSON.stringify(s[b] ?? null).length);
      for (const k of keys) {
        current = k;
        dirty.delete(k);
        try {
          if (await writeKey(k, JSON.parse(JSON.stringify(s[k] ?? null)))) await writeMeta();
        } catch (e) {
          dirty.add(k);
          throw e;
        }
      }
      backoff = 0;
      useCloud.setState({ status: "synced", message: undefined });
    } catch (e) {
      const code = (e as { code?: string }).code;
      backoff = Math.min(Math.max(backoff * 2, 3000), 300000);
      // Journal d'erreur dans le compte, pour pouvoir diagnostiquer à distance.
      db.doc(`${root}/synclog`).set({ at: new Date().toISOString(), key: current ?? null, code: code ?? null, message: String((e as Error)?.message ?? e).slice(0, 300) }).catch(() => {});
      // Trop d'écritures d'un coup ou incident passager : on patiente, rien n'est perdu.
      const transient = code === "resource_exhausted" || code === "unavailable" || !code;
      useCloud.setState({
        status: transient ? "waiting" : "error",
        message:
          code === "quota_exceeded" ? "Espace de sauvegarde plein : exporte puis réinitialise les vieilles données."
          : `Sauvegarde en ligne en attente (${code ?? "erreur"}), nouvel essai dans ${Math.round(backoff / 1000)} s. Tes données restent sur cet appareil.`,
      });
      if (code !== "quota_exceeded" && code !== "invalid_argument") schedule(backoff);
    } finally {
      writing = false;
      if (dirty.size && backoff === 0) schedule(1500);
    }
  };

  const markAll = () => SYNC_KEYS.forEach((k) => dirty.add(k));

  try {
    const found = await loadRemote();
    if (!found) {
      // Premier lancement sur ce compte : on envoie ce qui est sur l'appareil.
      markAll();
      await flush();
    }
    useCloud.setState({ status: "synced" });
  } catch {
    applyEmbeddedPacks();
    useCloud.setState({ status: "error", message: "Impossible de lire la sauvegarde en ligne." });
    return;
  }

  useStore.subscribe((s, prev) => {
    if (applying) return;
    let changed = false;
    for (const k of SYNC_KEYS) if (s[k] !== prev[k]) { dirty.add(k); changed = true; }
    if (changed && backoff === 0) schedule(1500);
  });

  // Clés jamais enregistrées dans le compte, ou modifiées ici sans avoir été enregistrées : on les envoie.
  for (const k of SYNC_KEYS) if (chunks[k] === undefined || keepLocal.has(k)) dirty.add(k);
  keepLocal.clear();
  repair();
  if (dirty.size) schedule(1500);
  await pullInbox(db);

  // Au retour sur l'appli (autre appareil utilisé entre-temps) : on recharge si quelqu'un d'autre a écrit.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || writing || dirty.size) return;
    try {
      const meta = await metaRef.get();
      if (meta.exists && (meta.data() as { stamp: string }).stamp !== lastWriteStamp) {
        await loadRemote();
        repair();
      }
      await pullInbox(db);
    } catch {
      /* on réessaiera au prochain retour */
    }
  });
}

/**
 * Boîte de réception : la tâche automatique (Claude, chaque soir) y dépose des paquets de contenu
 * (nouveaux mots / personnages du prof, questions sur l'actu du jour). On fusionne ceux pas encore vus.
 */
async function pullInbox(db: any) {
  try {
    const snap = await db.collection("inbox").get();
    const done = new Set(useStore.getState().inboxDone);
    let added = 0;
    for (const d of snap.docs) {
      if (done.has(d.id)) continue;
      const pack = { ...(d.data() as ContentPack), id: d.id };
      added += useStore.getState().mergePack(pack);
    }
    if (added > 0) useStore.getState().toast({ title: "📬 Nouveautés importées", body: `${added} nouvelles cartes ou fiches à réviser`, tone: "good" });
  } catch {
    /* boîte vide ou indisponible */
  }
}

/** Enregistre un fichier : via claude.ai si disponible, sinon lien de téléchargement classique. */
export async function saveFile(filename: string, data: string) {
  const downloads = await capability("downloads");
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return true;
    } catch (e) {
      return (e as { code?: string }).code === "declined" ? false : fallback();
    }
  }
  return fallback();
  function fallback() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = filename;
    a.click();
    return true;
  }
}
