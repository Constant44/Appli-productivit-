/**
 * Alarme de fin de pomodoro. Les notifications système sont refusées dans une page claude.ai :
 * on garde donc l'écran allumé pendant la session (wake lock) et on fait sonner une alarme
 * qui insiste jusqu'à ce qu'on touche l'écran.
 * Le son doit être « débloqué » pendant un geste de l'utilisateur : armAlarm() est appelé au démarrage du chrono.
 */
let ctx: AudioContext | null = null;
let wake: { release: () => Promise<void> } | null = null;
let ringing: ReturnType<typeof setInterval> | null = null;
let ringStop: ReturnType<typeof setTimeout> | null = null;

function chime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [784, 988, 1175, 1568].forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.16);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.16 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.3);
    o.connect(g).connect(ctx!.destination);
    o.start(t0 + i * 0.16);
    o.stop(t0 + i * 0.16 + 0.32);
  });
}

/** À appeler pendant un clic (démarrage du chrono) : débloque le son et garde l'écran allumé. */
export function armAlarm() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === "suspended") void ctx.resume();
    // son inaudible : finit de débloquer l'audio sur iOS
    if (ctx) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.05);
    }
  } catch {
    /* audio indisponible */
  }
  void keepAwake();
}

async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (!wake && nav.wakeLock && document.visibilityState === "visible") wake = await nav.wakeLock.request("screen");
  } catch {
    /* refusé : l'alarme sonnera quand même si l'appli est ouverte */
  }
}

/** Le verrou d'écran saute quand on change d'onglet : on le reprend au retour si une session tourne. */
export function rearmWake(active: boolean) {
  if (active) void keepAwake();
  else releaseWake();
}

export function releaseWake() {
  if (wake) void wake.release().catch(() => {});
  wake = null;
}

/** Sonne toutes les 2 s pendant 1 min au plus, jusqu'à ce qu'on touche l'écran. */
export function ringAlarm() {
  stopAlarm();
  if (ctx?.state === "suspended") void ctx.resume();
  chime();
  try { navigator.vibrate?.([400, 200, 400]); } catch { /* pas de vibreur */ }
  ringing = setInterval(chime, 2000);
  ringStop = setTimeout(stopAlarm, 60_000);
  const off = () => { stopAlarm(); document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", off); };
  setTimeout(() => { document.addEventListener("pointerdown", off); document.addEventListener("keydown", off); }, 300);
}

export function stopAlarm() {
  if (ringing) clearInterval(ringing);
  if (ringStop) clearTimeout(ringStop);
  ringing = ringStop = null;
}
