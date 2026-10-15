import { useStore, type PronoteSyncPayload } from "./store";
import { addDays } from "./utils";

export type SyncCredentials = { url?: string; username?: string; password?: string; qr?: unknown; pin?: string };

/** Synchronise avec Pronote via le serveur local. Utilise le token enregistré si pas de mot de passe. */
export async function syncPronote(creds: SyncCredentials = {}) {
  const st = useStore.getState();
  const cfg = st.pronote;
  const body = {
    url: creds.url ?? cfg.url,
    username: creds.username ?? cfg.username,
    password: creds.password,
    token: creds.password || creds.qr ? undefined : cfg.token,
    qr: creds.qr,
    pin: creds.pin,
    deviceUUID: cfg.deviceUUID,
    from: addDays(new Date(), -7).toISOString(),
    to: addDays(new Date(), 35).toISOString(),
  };
  let res: Response;
  try {
    res = await fetch("/api/pronote/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Serveur local injoignable : lance l'appli avec `npm run dev` ou `npm start`.");
  }
  const data = await res.json().catch(() => ({ ok: false, error: `Réponse invalide (HTTP ${res.status})` }));
  if (!data.ok) throw new Error(data.error ?? "Échec de la synchronisation");
  return st.applyPronoteSync(data as PronoteSyncPayload);
}
