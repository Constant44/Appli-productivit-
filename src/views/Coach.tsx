/**
 * Écran « Maintenant » : une seule consigne à la fois, un gros bouton pour s'y mettre.
 * Ordre de la journée : échauffement (rappel actif) → blocs du programme → c'est fini, tu peux t'arrêter.
 * Chaque consigne dit quoi faire, combien de temps, pourquoi, et comment le faire bien.
 */
import { useEffect, useMemo, useState } from "react";
import { timerElapsedMs, useStore } from "../lib/store";
import type { Evaluation, Task } from "../lib/types";
import { addDays, daysUntil, fmtClock, fmtMin, fmtRelDay, isoDay, subjectColor } from "../lib/utils";
import { CompleteTaskModal } from "../components/forms";
import { navigate, type View } from "../App";
import { EDHEC_DATE } from "./Edhec";
import { calAlarmStatus } from "../lib/calAlarm";
import { focusInsights } from "../lib/focusInsights";
import Tasks from "./Tasks";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « de maths », « d'entretien » */
const de = (s: string) => (/^[aeiouyéèêàâîôûh]/i.test(s) ? `d'${s.toLowerCase()}` : `de ${s.toLowerCase()}`);

/** Comment faire le bloc (méthodes qui marchent : se tester, s'entraîner comme le jour J, espacer). */
function howTo(t: Task): string {
  const k = t.program ?? "";
  if (k.startsWith("ev-")) return "Pas de relecture passive : refais des exercices ou des questions sans regarder le cours, puis corrige-toi et note tes erreurs.";
  if (k.startsWith("anki-")) return "Toutes les cartes dues d'abord. Réponds dans ta tête avant de retourner la carte, et sois honnête sur la note.";
  if (k.startsWith("actu-veille")) return "Fais les cartes du test sans regarder les fiches. Ce que tu rates, relis-le une fois puis reteste-toi.";
  if (k.startsWith("actu-")) return "Lis, puis ferme le document et écris de mémoire 3 faits (qui, quoi, chiffre).";
  if (k.startsWith("edhec-blanc")) return "Conditions réelles : chrono lancé, aucune aide, pas de pause.";
  if (k.startsWith("edhec-trad")) return "Traduis d'abord seul, sans dictionnaire, puis compare au corrigé phrase par phrase.";
  if (k.startsWith("edhec-syn")) return "Synthèse chronométrée, sujet tiré au hasard. Pas de pause pendant l'épreuve.";
  if (k.startsWith("edhec-")) return "Lis la partie du chapitre, puis fais les exercices sans le corrigé. Bloqué plus de 10 min : regarde l'indice et continue.";
  if (t.kind === "devoir") return "Fais-le d'une traite, sans téléphone. Fini, c'est fini : coche.";
  return "Un seul objectif pour ce bloc. Note ce qui te bloque au lieu de t'arrêter.";
}

/** Pourquoi maintenant (l'échéance ou l'enjeu derrière le bloc). */
function why(t: Task, evals: Evaluation[]): string {
  const e = t.evalId ? evals.find((x) => x.id === t.evalId) : undefined;
  if (e) return `${e.type} ${de(e.subject)} ${fmtRelDay(e.date)}${e.topic ? ` · ${e.topic}` : ""}`;
  const k = t.program ?? "";
  if (k.startsWith("anki-")) return "Rappel espacé : ce qui fixe le plus durablement ce que tu apprends";
  if (k.startsWith("actu")) return "Le test du vendredi se gagne un peu chaque jour";
  if (k.startsWith("edhec")) return `EDHEC dans ${daysUntil(EDHEC_DATE)} jours`;
  if (t.due) return `À rendre ${fmtRelDay(t.due)}`;
  return t.subject;
}

const readSkips = (day: string): string[] => {
  try { return JSON.parse(localStorage.getItem(`coach-skip-${day}`) ?? "[]"); } catch { return []; }
};
const writeSkips = (day: string, ids: string[]) => {
  try { localStorage.setItem(`coach-skip-${day}`, JSON.stringify(ids)); } catch { /* stockage indisponible */ }
};

type Step = { kind: "warmup" } | { kind: "task"; task: Task };

export default function Coach() {
  const tasks = useStore((s) => s.tasks);
  const evals = useStore((s) => s.evals);
  const warmups = useStore((s) => s.warmups);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const pauseTimer = useStore((s) => s.pauseTimer);
  const resumeTimer = useStore((s) => s.resumeTimer);
  const [now, setNow] = useState(() => new Date());
  const today = isoDay(now);
  const [skips, setSkips] = useState<string[]>(() => readSkips(today));
  const [completing, setCompleting] = useState<Task | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), timer.status === "running" ? 1000 : 30000);
    return () => clearInterval(id);
  }, [timer.status]);
  useEffect(() => setSkips(readSkips(today)), [today]);

  // Les blocs du jour : programme + devoirs à rendre aujourd'hui ou en retard
  const blocks = useMemo(() => {
    const prog = tasks.filter((t) => t.plannedFor === today);
    // Devoirs à rendre aujourd'hui ou en retard de moins de 3 jours, dans la limite du temps qui reste
    // (le reste attend dans la to-do : la journée ne doit pas dépasser l'objectif quotidien).
    const room = Math.max(30, goal - prog.reduce((a, t) => a + t.estimateMin, 0));
    let used = 0;
    const extra = tasks
      .filter((t) => !t.plannedFor && !t.done && t.due && t.due <= today && t.due >= isoDay(addDays(new Date(`${today}T12:00:00`), -3)))
      .sort((a, b) => b.priority - a.priority || (a.due ?? "").localeCompare(b.due ?? ""))
      .filter((t) => (used += t.estimateMin) <= room);
    return [...prog, ...extra].sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || (a.due ?? "").localeCompare(b.due ?? ""));
  }, [tasks, today, goal]);
  const todo = blocks.filter((t) => !t.done);
  const done = blocks.filter((t) => t.done);
  const ordered = [...todo.filter((t) => !skips.includes(t.id)), ...todo.filter((t) => skips.includes(t.id))];
  const warmedUp = warmups.includes(today);

  const steps: Step[] = [...(warmedUp ? [] : [{ kind: "warmup" } as Step]), ...ordered.map((task) => ({ kind: "task", task }) as Step)];
  const isSkipped = (s: Step) => skips.includes(s.kind === "warmup" ? "warmup" : s.task.id);
  const current = [...steps.filter((s) => !isSkipped(s)), ...steps.filter(isSkipped)][0];

  const totalMin = blocks.reduce((a, t) => a + t.estimateMin, 0) + 15;
  const doneMin = done.reduce((a, t) => a + t.estimateMin, 0) + (warmedUp ? 15 : 0);
  const pct = totalMin ? Math.min(100, Math.round((doneMin / totalMin) * 100)) : 0;

  const skip = (id: string) => {
    const next = [...skips.filter((x) => x !== id), id];
    setSkips(next);
    writeSkips(today, next);
  };

  const start = (t: Task) => {
    startTimer({ mode: "pomodoro", targetMin: Math.max(10, Math.min(t.estimateMin, 50)), taskId: t.id, subject: t.subject });
    navigate((t.link as View) || "focus");
  };

  const running = timer.status !== "idle" && timer.phase === "work";
  const onBreak = timer.status !== "idle" && timer.phase === "break";
  const breakLeft = onBreak ? Math.max(0, timer.targetMin * 60 - timerElapsedMs(timer) / 1000) : 0;
  const runTask = running ? tasks.find((t) => t.id === timer.taskId) : undefined;
  const left = running ? Math.max(0, timer.targetMin * 60 - timerElapsedMs(timer) / 1000) : 0;
  const nextEval = evals.filter((e) => +new Date(e.date) >= +now).sort((a, b) => a.date.localeCompare(b.date))[0];
  const sessions = useStore((s) => s.sessions);
  const focusTip = useMemo(() => {
    const f = focusInsights(sessions);
    if (!f.best) return "";
    return `Tu te concentres le mieux ${f.best.key} (${f.best.avg.toFixed(1).replace(".", ",")}/10) : garde-y les blocs les plus durs.`;
  }, [sessions]);
  const hello = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="coach">
      <header className="coach-head">
        <div className="eyebrow">{DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}</div>
        <h1>{hello} Constant</h1>
        <div className="coach-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="small muted">
          {todo.length + (warmedUp ? 0 : 1) === 0 ? "Journée bouclée" : `${fmtMin(doneMin)} faites sur ${fmtMin(totalMin)} · ${todo.length + (warmedUp ? 0 : 1)} étape${todo.length + (warmedUp ? 0 : 1) > 1 ? "s" : ""} restante${todo.length + (warmedUp ? 0 : 1) > 1 ? "s" : ""}`}
          {nextEval ? ` · prochain : ${nextEval.type} ${de(nextEval.subject)} ${fmtRelDay(nextEval.date)}` : ""}
        </div>
        {focusTip && <div className="small coach-tip">🎯 {focusTip}</div>}
      </header>

      {onBreak ? (
        <section className="directive" style={{ ["--dir" as string]: "#38bdf8" }}>
          <div className="dir-label">PAUSE</div>
          <h2>Lève-toi, bois un verre d'eau, pas d'écran.</h2>
          <div className="dir-clock">{fmtClock(Math.round(breakLeft))}</div>
          <p className="dir-how">{calAlarmStatus.state === "on" ? "Google Agenda te notifie à la fin de la pause." : "Reviens quand le décompte est à zéro."}</p>
          <div className="dir-actions"><button className="btn ghost" onClick={() => useStore.getState().cancelTimer()}>Passer la pause</button></div>
        </section>
      ) : running ? (
        <section className="directive live">
          <div className="dir-label">EN COURS</div>
          <h2>{runTask?.title ?? timer.subject ?? "Session de travail"}</h2>
          <div className="dir-clock">{fmtClock(Math.round(left))}</div>
          <p className="dir-how">📵 Téléphone dans une autre pièce. Un seul onglet ouvert. Si une idée parasite arrive, note-la et continue.<br />{calAlarmStatus.state === "on" ? "🔔 Rappel programmé dans ton Google Agenda : notification à la fin, même sur une autre app ou téléphone verrouillé." : "⏱️ Pas de son : jette un œil au chrono, ou active la notification Google Agenda dans les Réglages."}</p>
          <div className="dir-actions">
            {timer.status === "running"
              ? <button className="btn big" onClick={pauseTimer}>⏸ Pause</button>
              : <button className="btn primary big" onClick={resumeTimer}>▶ Reprendre</button>}
            <button className="btn ghost" onClick={() => navigate((runTask?.link as View) || "focus")}>Ouvrir l'outil →</button>
          </div>
        </section>
      ) : !current ? (
        <section className="directive done">
          <div className="dir-label">C'EST FINI POUR AUJOURD'HUI</div>
          <h2>Programme bouclé. Tu peux t'arrêter.</h2>
          <p className="dir-how">Le repos fait partie du travail : le sommeil consolide ce que tu as appris aujourd'hui. Si tu as encore de l'énergie, un bonus court :</p>
          <div className="dir-actions">
            <button className="btn" onClick={() => navigate("edhec")}>🇬🇧 10 QCM d'anglais</button>
            <button className="btn" onClick={() => navigate("vendredi")}>🗞️ Cartes du vendredi</button>
          </div>
        </section>
      ) : current.kind === "warmup" ? (
        <section className="directive" style={{ ["--dir" as string]: "#f59e0b" }}>
          <div className="dir-label">MAINTENANT · 15 MIN</div>
          <h2>Échauffement : tes cartes du jour</h2>
          <p className="dir-why">On commence par se tester : c'est le moyen le plus sûr de retenir, et ça lance la journée.</p>
          <p className="dir-how">Réponds dans ta tête avant de retourner chaque carte. Ce que tu rates reviendra demain.</p>
          <div className="dir-actions">
            <button className="btn primary big" onClick={() => navigate("warmup")}>▶ Commencer</button>
            <button className="btn ghost" onClick={() => skip("warmup")}>Plus tard</button>
          </div>
        </section>
      ) : (
        <section className="directive" style={{ ["--dir" as string]: subjectColor(current.task.subject) }}>
          <div className="dir-label">MAINTENANT · {fmtMin(current.task.estimateMin).toUpperCase()}</div>
          <h2>{current.task.title}</h2>
          <p className="dir-why">{why(current.task, evals)}</p>
          <p className="dir-how">{howTo(current.task)}</p>
          <div className="dir-actions">
            <button className="btn primary big" onClick={() => start(current.task)}>▶ Commencer · {fmtMin(Math.max(10, Math.min(current.task.estimateMin, 50)))}</button>
            <button className="btn" onClick={() => setCompleting(current.task)}>✓ Déjà fait</button>
            <button className="btn ghost" onClick={() => skip(current.task.id)}>Plus tard</button>
          </div>
        </section>
      )}

      <Tasks embedded />

      {ordered.length > (current?.kind === "task" ? 1 : 0) && (
        <section className="coach-list">
          <h3>Programme : ensuite</h3>
          {ordered.filter((t) => !(current?.kind === "task" && current.task.id === t.id)).map((t) => (
            <div key={t.id} className="coach-row">
              <span className="subject-bar" style={{ background: subjectColor(t.subject) }} />
              <span className="coach-row-t">{t.title}</span>
              <span className="small muted">{fmtMin(t.estimateMin)}</span>
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <details className="coach-list">
          <summary><h3 style={{ display: "inline" }}>Fait aujourd'hui ✓ {done.length}</h3></summary>
          {done.map((t) => (
            <div key={t.id} className="coach-row done">
              <span className="coach-row-t">{t.title}</span>
              <span className="small muted">{fmtMin(t.estimateMin)}</span>
            </div>
          ))}
        </details>
      )}

      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}
