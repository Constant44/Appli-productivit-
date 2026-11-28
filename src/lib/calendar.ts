/**
 * Google Agenda (via ton compte claude.ai) :
 * - une notification à la fin de chaque séance Focus et de chaque pause (l'agenda notifie même téléphone verrouillé) ;
 * - un bloc 🍅 dans l'agenda pour chaque séance validée (pas de rappel).
 * Si l'agenda n'est pas accessible, l'appli fonctionne pareil, sans notification.
 */
import { create } from "zustand";
import { capability } from "./runtime";
import { useStore } from "./store";

const SERVER = "Google Calendar";
const KEY = "cadence-alarm";

const local = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const read = (): { id?: string; end: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const write = (v: { id?: string; end: number } | null) => {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
};

/* ---------- état de la liaison (pour ne plus échouer en silence) ---------- */
export type CalState = "ok" | "prompt" | "denied" | "missing" | "unknown";
type CalStatus = { state: CalState; code?: string; at?: number; queued: number };
const QKEY = "cadence-cal-queue";
type Queued = { input: Record<string, unknown>; at: number };
const loadQ = (): Queued[] => {
  try {
    return JSON.parse(localStorage.getItem(QKEY) ?? "[]");
  } catch {
    return [];
  }
};
const saveQ = (q: Queued[]) => {
  try {
    localStorage.setItem(QKEY, JSON.stringify(q.slice(-30)));
  } catch {
    /* rien */
  }
};
export const useCal = create<CalStatus>(() => ({ state: "unknown", queued: loadQ().length }));
const PERM = `mcp:${SERVER}`;

const stateOf = (code?: string): CalState =>
  code === "server_not_connected" || code === "needs_reauth" || code === "server_not_found" ? "missing"
  : code === "not_in_manifest" || code === "blocked_by_policy" ? "denied"
  : code === "approval_required" ? "prompt" : "unknown";

let warned = "";
function fail(code: string) {
  const st = stateOf(code);
  useCal.setState({ state: st === "unknown" ? useCal.getState().state : st, code, at: Date.now() });
  if (warned === code) return;
  warned = code;
  const msg = st === "missing" ? "Google Agenda n'est pas connecté sur ce navigateur : pas de notification ni de bloc 🍅. Réglages → Google Agenda."
    : st === "denied" ? "Google Agenda est refusé pour Cadence sur ce navigateur. Réglages → Google Agenda → Ouvrir les autorisations."
    : st === "prompt" ? "Google Agenda attend ton autorisation. Réglages → Google Agenda → Relier."
    : `Google Agenda n'a pas répondu (${code}). Le bloc sera réessayé.`;
  useStore.getState().toast(msg, { tone: "info" });
}

/** Appel à l'agenda qui note le résultat ; réessaie une fois si le runtime le permet. */
async function call(tool: string, input: Record<string, unknown>): Promise<{ id?: string } | null> {
  const mcp = await capability("mcp");
  if (!mcp) {
    fail("server_not_connected");
    return null;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await mcp.callTool(SERVER, tool, input, { cache: false });
      useCal.setState({ state: "ok", code: undefined, at: Date.now() });
      warned = "";
      return (r?.payload as { id?: string } | undefined) ?? {};
    } catch (e) {
      const err = e as { code?: string; retryable?: boolean; retryAfterMs?: number };
      if (attempt === 0 && err?.retryable && tool === "create_event" && err.code !== "server_unavailable") {
        await new Promise((res) => setTimeout(res, Math.min(err.retryAfterMs ?? 3000, 15000)));
        continue;
      }
      fail(err?.code ?? "upstream_error");
      return null;
    }
  }
  return null;
}

/** Lit l'état de l'autorisation sans rien demander. */
export async function refreshCal() {
  const perms = await capability("permissions");
  let st: CalState = useCal.getState().state;
  try {
    const p = perms ? await perms.state(PERM) : "unavailable";
    if (p === "granted" && st !== "missing") st = st === "unknown" || st === "prompt" || st === "denied" ? "ok" : st;
    else if (p === "prompt") st = "prompt";
    else if (p === "denied") st = "denied";
    else if (p === "unavailable" && !perms) st = "missing";
  } catch {
    /* garde l'état connu */
  }
  useCal.setState({ state: st, queued: loadQ().length });
  return st;
}

/** Bouton « Relier » : demande l'accès, fait un vrai essai (c'est lui qui déclenche la demande d'autorisation), puis envoie les blocs en attente. Dit toujours ce qui s'est passé. */
export async function connectCal() {
  const toast = useStore.getState().toast;
  const perms = await capability("permissions");
  const mcp = await capability("mcp");
  let p = "absent";
  try {
    if (perms) p = (await perms.request([PERM]))?.[PERM] ?? "unavailable";
  } catch {
    p = "erreur";
  }
  if (!mcp) {
    useCal.setState({ state: "missing", code: `mcp indisponible · autorisation ${p}` });
    toast(`Cette vue de Cadence n'a pas accès aux connecteurs (autorisation : ${p}). Ouvre Cadence depuis claude.ai dans Safari (pas l'aperçu ni un raccourci hors connexion), connecté à ton compte, puis réessaie.`, { tone: "info" });
    return "missing" as CalState;
  }
  if (p === "denied") {
    useCal.setState({ state: "denied", code: "autorisation refusée" });
    try {
      await perms.manage();
    } catch {
      toast("Autorisation refusée : en haut de la page de l'artifact, ouvre le menu (⋯) → Autorisations → active Google Calendar, puis recharge.", { tone: "info" });
      return "denied" as CalState;
    }
  }
  warned = "";
  const start = Date.now() + 60000;
  const r = await call("create_event", {
    summary: "⏰ Cadence est relié à ton agenda", startTime: local(start), endTime: local(start + 60000),
    overrideReminders: [{ method: "popup", minutes: 0 }], availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
    description: "Test de liaison de Cadence (supprimé tout seul).",
  });
  if (r) {
    toast("✓ Google Agenda relié. Petite notif test dans 1 minute.", { tone: "info" });
    setTimeout(() => void del(r.id), 4 * 60000);
    await flushQueue();
  } else {
    const c = useCal.getState().code;
    toast(`Toujours pas relié (code : ${c ?? "inconnu"}, autorisation : ${p}). Envoie-moi ce code.`, { tone: "info" });
  }
  return useCal.getState().state;
}

export async function manageCal() {
  const perms = await capability("permissions");
  try {
    await perms?.manage();
  } catch {
    useStore.getState().toast("Ouvre le menu Autorisations de l'artifact (en haut de la page) et active Google Calendar.", { tone: "info" });
  }
  return refreshCal();
}

/** Notification test dans 1 minute : vérifie que tout marche sur cet appareil. */
export async function testCal() {
  const start = Date.now() + 60000;
  const r = await call("create_event", {
    summary: "⏰ Test Cadence : la notification marche", startTime: local(start), endTime: local(start + 60000),
    overrideReminders: [{ method: "popup", minutes: 0 }], availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
    description: "Test de Cadence (supprimé tout seul).",
  });
  if (r) {
    useStore.getState().toast("Notification test prévue dans 1 minute ✓", { tone: "info" });
    setTimeout(() => void del(r.id), 4 * 60000);
  }
  return !!r;
}

async function flushQueue() {
  const q = loadQ();
  if (!q.length) return;
  const left: Queued[] = [];
  for (const it of q) if (!(await call("create_event", it.input))) left.push(it);
  saveQ(left);
  useCal.setState({ queued: left.length });
  if (q.length > left.length) useStore.getState().toast(`${q.length - left.length} bloc${q.length - left.length > 1 ? "s" : ""} 🍅 ajouté${q.length - left.length > 1 ? "s" : ""} à l'agenda`, { tone: "info" });
}

async function del(id?: string) {
  if (!id) return;
  const mcp = await capability("mcp");
  try {
    await mcp?.callTool(SERVER, "delete_event", { eventId: id, notificationLevel: "NONE" });
  } catch {
    /* déjà supprimé */
  }
}

/** Programme la notification de fin (remplace la précédente). */
export async function scheduleAlarm(end: number, summary: string) {
  await cancelAlarm();
  if (end - Date.now() < 60000) return;
  write({ end });
  const r = await call("create_event", {
    summary: `⏰ ${summary}`.slice(0, 90), startTime: local(end), endTime: local(end + 60000),
    overrideReminders: [{ method: "popup", minutes: 0 }], availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
    description: "Rappel automatique de Cadence (supprimé tout seul).",
  });
  if (!r) {
    if (read()?.end === end) write(null);
    return;
  }
  if (read()?.end !== end) return del(r.id);
  write({ end, id: r.id });
  void flushQueue();
}

/** Retire la notification en attente (immédiatement, ou quelques minutes après si la séance vient de finir). */
export async function cancelAlarm(later = false) {
  const cur = read();
  if (!cur) return;
  write(null);
  if (later || Date.now() >= cur.end - 5000) setTimeout(() => void del(cur.id), 3 * 60000);
  else await del(cur.id);
}

/** Bloc 🍅 dans l'agenda pour une séance validée en mode Focus (mis en attente si l'agenda ne répond pas). */
export async function logBlock(title: string, minutes: number, distractions: number) {
  if (minutes < 5) return;
  const end = Date.now();
  const input = {
    summary: `🍅 ${title}`.slice(0, 80), startTime: local(end - minutes * 60000), endTime: local(end),
    colorId: "11", useDefaultReminders: false, availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
    description: `${minutes} min de travail validées${distractions ? ` · ${distractions} décrochage${distractions > 1 ? "s" : ""}` : " · aucun décrochage"}. Ajouté par Cadence.`,
  };
  if (await call("create_event", input)) return void flushQueue();
  const q = [...loadQ(), { input, at: end }];
  saveQ(q);
  useCal.setState({ queued: q.length });
}
