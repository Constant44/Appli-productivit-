/**
 * Google Agenda (via ton compte claude.ai) :
 * - une notification à la fin de chaque séance Focus et de chaque pause (l'agenda notifie même téléphone verrouillé) ;
 * - un bloc 🍅 dans l'agenda pour chaque séance validée (pas de rappel).
 * Si l'agenda n'est pas accessible, l'appli fonctionne pareil, sans notification.
 */
import { capability } from "./runtime";

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
  const mcp = await capability("mcp");
  if (!mcp) return;
  write({ end });
  try {
    const r = await mcp.callTool(SERVER, "create_event", {
      summary: `⏰ ${summary}`.slice(0, 90), startTime: local(end), endTime: local(end + 60000),
      overrideReminders: [{ method: "popup", minutes: 0 }], availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
      description: "Rappel automatique de Cadence (supprimé tout seul).",
    }, { cache: false });
    const id = (r?.payload as { id?: string } | undefined)?.id;
    if (read()?.end !== end) return del(id);
    write({ end, id });
  } catch {
    write(null);
  }
}

/** Retire la notification en attente (immédiatement, ou quelques minutes après si la séance vient de finir). */
export async function cancelAlarm(later = false) {
  const cur = read();
  if (!cur) return;
  write(null);
  if (later || Date.now() >= cur.end - 5000) setTimeout(() => void del(cur.id), 3 * 60000);
  else await del(cur.id);
}

/** Bloc 🍅 dans l'agenda pour une séance validée en mode Focus. */
export async function logBlock(title: string, minutes: number, distractions: number) {
  if (minutes < 5) return;
  const mcp = await capability("mcp");
  if (!mcp) return;
  const end = Date.now();
  try {
    await mcp.callTool(SERVER, "create_event", {
      summary: `🍅 ${title}`.slice(0, 80), startTime: local(end - minutes * 60000), endTime: local(end),
      colorId: "11", useDefaultReminders: false, availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
      description: `${minutes} min de travail validées${distractions ? ` · ${distractions} décrochage${distractions > 1 ? "s" : ""}` : " · aucun décrochage"}. Ajouté par Cadence.`,
    }, { cache: false });
  } catch {
    /* l'agenda n'est pas indispensable */
  }
}
