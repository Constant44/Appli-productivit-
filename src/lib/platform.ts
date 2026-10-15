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
import { useStore } from "./store";
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
const SYNC_KEYS = ["tasks", "evals", "sessions", "plans", "grades", "lessons", "customEvents", "pronote", "club", "xp", "coins", "settings", "timer"] as const;
type SyncKey = (typeof SYNC_KEYS)[number];
const CHUNK = 400;

export type CloudStatus = "local" | "connecting" | "synced" | "saving" | "error";
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
        if (snap.exists) patch[key] = (snap.data() as { v: unknown }).v;
      } else {
        const parts: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const snap = await db.doc(`${root}/${key}-${i}`).get();
          if (snap.exists) parts.push(...((snap.data() as { v: unknown[] }).v ?? []));
        }
        patch[key] = parts;
      }
    }
    chunks = m.chunks ?? {};
    lastWriteStamp = m.stamp;
    applying = true;
    useStore.setState(patch as never);
    applying = false;
    return true;
  };

  const writeKey = async (key: SyncKey, value: unknown) => {
    if (Array.isArray(value)) {
      const n = Math.max(1, Math.ceil(value.length / CHUNK));
      for (let i = 0; i < n; i++) await db.doc(`${root}/${key}-${i}`).set({ v: value.slice(i * CHUNK, (i + 1) * CHUNK) });
      for (let i = n; i < (chunks[key] ?? 0); i++) await db.doc(`${root}/${key}-${i}`).delete();
      chunks[key] = n;
    } else {
      await db.doc(`${root}/${key}`).set({ v: value ?? null });
      chunks[key] = 0;
    }
  };

  let applying = false;
  let dirty = new Set<SyncKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;

  const flush = async () => {
    if (writing || !dirty.size) return;
    writing = true;
    const keys = [...dirty];
    dirty = new Set();
    useCloud.setState({ status: "saving" });
    try {
      const s = useStore.getState();
      for (const k of keys) await writeKey(k, JSON.parse(JSON.stringify(s[k])));
      lastWriteStamp = `${deviceId}:${Date.now()}`;
      await metaRef.set({ chunks, stamp: lastWriteStamp });
      useCloud.setState({ status: "synced", message: undefined });
    } catch (e) {
      for (const k of keys) dirty.add(k);
      const code = (e as { code?: string }).code;
      useCloud.setState({
        status: "error",
        message: code === "quota_exceeded" ? "Espace de sauvegarde plein : exporte puis réinitialise les vieilles données." : "Sauvegarde en ligne impossible pour l'instant, nouvel essai bientôt.",
      });
      if (code !== "quota_exceeded" && code !== "invalid_argument") timer = setTimeout(flush, 15000);
    } finally {
      writing = false;
      if (dirty.size) timer = setTimeout(flush, 1500);
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
    if (changed) {
      clearTimeout(timer);
      timer = setTimeout(flush, 1500);
    }
  });

  // Au retour sur l'appli (autre appareil utilisé entre-temps) : on recharge si quelqu'un d'autre a écrit.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || writing || dirty.size) return;
    try {
      const meta = await metaRef.get();
      if (meta.exists && (meta.data() as { stamp: string }).stamp !== lastWriteStamp) await loadRemote();
    } catch {
      /* on réessaiera au prochain retour */
    }
  });
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
