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

export async function startCloudSync() {
  if (!runtime()) return; // pas dans claude.ai
  useCloud.setState({ status: "connecting" });
  const [db, user] = await Promise.all([capability("db"), capability("user")]);
  const id: string | null = user ? await user.id().catch(() => null) : null;
  if (!db || !id) {
    useCloud.setState({ status: "local", message: "Sauvegarde en ligne indisponible : données gardées sur cet appareil." });
    return;
  }
  const root = `data/users/${id}`;
  const metaRef = db.doc(`${root}/meta`);
  let chunks: Partial<Record<SyncKey, number>> = {};
  let lastWriteStamp = "";
  let remoteHadFallen = true;

  /**
   * Après un chargement : nettoyage des données d'une version plus ancienne et packs embarqués pas encore fusionnés.
   * Appelé une fois l'abonnement en place, pour que le résultat soit réenregistré dans le compte.
   */
  const repair = () => {
    const st = useStore.getState();
    if (st.cards.some((c) => c.deck === "mot" && !c.id.endsWith("-def"))) useStore.setState(onlyDefinitions(st));
    if (!remoteHadFallen && !st.fallen.includes("P28")) useStore.setState({ fallen: [...st.fallen, "P28"] });
    applyEmbeddedPacks();
  };

  const loadRemote = async () => {
    const meta = await metaRef.get();
    if (!meta.exists) return false;
    const m = meta.data() as { chunks: Partial<Record<SyncKey, number>>; stamp: string };
    const patch: Record<string, unknown> = {};
    for (const key of SYNC_KEYS) {
      const n = m.chunks?.[key];
      if (n === undefined) continue;
      if (n === 0) {
        const snap = await db.doc(`${root}/${key}`).get();
        if (snap.exists) {
          patch[key] = (snap.data() as { v: unknown }).v;
          written.set(`${root}/${key}`, JSON.stringify(snap.data()));
        }
      } else {
        const parts: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const snap = await db.doc(`${root}/${key}-${i}`).get();
          if (snap.exists) {
            parts.push(...((snap.data() as { v: unknown[] }).v ?? []));
            written.set(`${root}/${key}-${i}`, JSON.stringify(snap.data()));
          }
        }
        patch[key] = parts;
      }
    }
    chunks = m.chunks ?? {};
    lastWriteStamp = m.stamp;
    applying = true;
    useStore.setState(patch as never);
    applying = false;
    remoteHadFallen = "fallen" in patch;
    return true;
  };

  /** Dernier contenu enregistré par document : on ne réécrit jamais un document identique. */
  const written = new Map<string, string>();
  const pause = () => new Promise((r) => setTimeout(r, 300));
  const writeDoc = async (path: string, body: Record<string, unknown>) => {
    const json = JSON.stringify(body);
    if (written.get(path) === json) return false;
    await db.doc(path).set(body);
    written.set(path, json);
    await pause(); // le service limite le nombre d'écritures par seconde
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
  const dirty = new Set<SyncKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;
  /** Délai d'attente après un refus (0 = tout va bien). Double à chaque échec, jusqu'à 5 min. */
  let backoff = 0;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  const flush = async () => {
    if (writing || !dirty.size) return;
    writing = true;
    useCloud.setState({ status: "saving" });
    try {
      const s = useStore.getState();
      let wrote = false;
      // Une clé à la fois : ce qui est enregistré n'est plus à refaire, même si la suite échoue.
      for (const k of [...dirty]) {
        dirty.delete(k);
        try {
          wrote = (await writeKey(k, JSON.parse(JSON.stringify(s[k] ?? null)))) || wrote;
        } catch (e) {
          dirty.add(k);
          throw e;
        }
      }
      if (wrote) {
        lastWriteStamp = `${deviceId}:${Date.now()}`;
        await writeDoc(`${root}/meta`, { chunks, stamp: lastWriteStamp });
      }
      backoff = 0;
      useCloud.setState({ status: "synced", message: undefined });
    } catch (e) {
      const code = (e as { code?: string }).code;
      backoff = Math.min(Math.max(backoff * 2, 3000), 300000);
      // Trop d'écritures d'un coup ou incident passager : on patiente, rien n'est perdu.
      const transient = code === "resource_exhausted" || code === "unavailable" || !code;
      useCloud.setState({
        status: transient ? "waiting" : "error",
        message:
          code === "quota_exceeded" ? "Espace de sauvegarde plein : exporte puis réinitialise les vieilles données."
          : `Sauvegarde en ligne en attente, nouvel essai dans ${Math.round(backoff / 1000)} s. Tes données restent sur cet appareil.`,
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
    useCloud.setState({ status: "error", message: "Impossible de lire la sauvegarde en ligne." });
    return;
  }

  useStore.subscribe((s, prev) => {
    if (applying) return;
    let changed = false;
    for (const k of SYNC_KEYS) if (s[k] !== prev[k]) { dirty.add(k); changed = true; }
    if (changed && backoff === 0) schedule(1500);
  });

  // Clés jamais enregistrées dans le compte (ajoutées par une version plus récente de l'appli) : on les envoie.
  for (const k of SYNC_KEYS) if (chunks[k] === undefined) dirty.add(k);
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
