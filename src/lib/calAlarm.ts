/**
 * Vraie notification de fin de pomodoro : un événement Google Agenda à l'heure de fin, avec un rappel « au début ».
 * L'app Google Agenda notifie même téléphone verrouillé ou appli fermée, ce qu'une page claude.ai ne peut pas faire.
 * L'événement est supprimé si le chrono est arrêté ou mis en pause avant la fin, et quelques minutes après la fin.
 */
import { capability } from "./platform";
import { useStore, type TimerState } from "./store";

const SERVER = "Google Calendar";
const KEY = "prepa-fc-cal-alarm";
type Pending = { key: string; end: number; eventId?: string };

const read = (): Pending | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
};
const write = (p: Pending | null) => {
  try { p ? localStorage.setItem(KEY, JSON.stringify(p)) : localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
};

/** Heure locale sans décalage (l'agenda applique le fuseau du compte). */
const local = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export type CalAlarmState = "off" | "on" | "unavailable" | "error";
export const calAlarmStatus: { state: CalAlarmState; message?: string } = { state: "off" };

async function remove(eventId?: string) {
  if (!eventId) return;
  const mcp = await capability("mcp");
  try { await mcp?.callTool(SERVER, "delete_event", { eventId, notificationLevel: "NONE" }); } catch { /* déjà supprimé */ }
}

async function create(t: TimerState, key: string) {
  const mcp = await capability("mcp");
  if (!mcp) { calAlarmStatus.state = "unavailable"; return; }
  const end = t.startedAt + t.targetMin * 60000 - t.accumulatedMs;
  if (end - Date.now() < 60000) return; // moins d'une minute : l'alarme de la page suffit
  const task = useStore.getState().tasks.find((x) => x.id === t.taskId);
  const summary = t.phase === "break" ? "⏰ Pause terminée : on y retourne" : `⏰ Pomodoro terminé${task ? ` : ${task.title.slice(0, 60)}` : ""}`;
  write({ key, end });
  try {
    const r = await mcp.callTool(SERVER, "create_event", {
      summary, startTime: local(end), endTime: local(end + 60000),
      overrideReminders: [{ method: "popup", minutes: 0 }],
      availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
      description: "Rappel automatique de Prépa FC (supprimé tout seul après la session).",
    }, { cache: false });
    const id = (r?.payload as { id?: string } | undefined)?.id;
    // le chrono a pu changer pendant l'appel : si ce n'est plus la même session, on retire l'événement
    if (read()?.key !== key) return remove(id);
    write({ key, end, eventId: id });
    calAlarmStatus.state = "on";
  } catch (e) {
    write(null);
    calAlarmStatus.state = "error";
    calAlarmStatus.message = (e as { code?: string }).code;
  }
}

/** Suit le chrono : crée l'événement au démarrage / à la reprise, le retire à l'arrêt ou à la pause. */
export function syncCalendarAlarm(t: TimerState) {
  if (useStore.getState().settings.calendarAlarm === false) return;
  const counting = t.status === "running" && t.mode !== "free";
  const key = counting ? `${t.startedAt}-${t.phase}` : "";
  const cur = read();
  if (cur?.key === key) return;
  if (cur) {
    // fin naturelle : on laisse le rappel partir avant de nettoyer l'agenda
    const finished = Date.now() >= cur.end - 5000;
    const id = cur.eventId;
    write(null);
    if (finished) setTimeout(() => void remove(id), 3 * 60000);
    else void remove(id);
  }
  if (counting) void create(t, key);
}

/**
 * Garde une trace de chaque pomodoro validé dans l'agenda : un bloc « 🍅 » du début à la fin de la session,
 * sans rappel. Les blocs s'accumulent jour après jour.
 */
export async function logPomodoroToCalendar(s: { minutes: number; title: string; focus10?: number; place?: string; recall?: string }) {
  if (useStore.getState().settings.calendarAlarm === false || s.minutes < 5) return;
  const mcp = await capability("mcp");
  if (!mcp) return;
  const end = Date.now();
  const start = end - s.minutes * 60000;
  const details = [
    s.focus10 ? `Concentration : ${s.focus10}/10` : "",
    s.place ? `Lieu : ${s.place}` : "",
    s.recall ? `Idées clés : ${s.recall}` : "",
    "Ajouté par Prépa FC.",
  ].filter(Boolean).join("\n");
  try {
    await mcp.callTool(SERVER, "create_event", {
      summary: `🍅 ${s.title.slice(0, 70)}`, startTime: local(start), endTime: local(end),
      colorId: "11", useDefaultReminders: false, availability: "AVAILABILITY_FREE", notificationLevel: "NONE",
      description: details,
    }, { cache: false });
  } catch {
    /* agenda indisponible : la session reste enregistrée dans l'appli */
  }
}
