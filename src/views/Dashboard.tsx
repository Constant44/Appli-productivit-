import { useMemo, useState } from "react";
import { useActiveCards, useStore } from "../lib/store";
import { recommend, unpreparedEvals, minutesByDay } from "../lib/insights";
import { DIVISIONS, MATCH_COST_MIN, standings, teamStrength } from "../lib/game";
import { daysUntil, fmtDay, fmtMin, fmtRelDay, fmtTime, isoDay, subjectColor } from "../lib/utils";
import type { Evaluation, Task } from "../lib/types";
import { Bar } from "../components/ui";
import { CompleteTaskModal, EvalForm, TaskForm } from "../components/forms";
import { navigate } from "../App";
import { EDHEC_DATE, currentPhase } from "./Edhec";
import { buildQueue, nextTestDay } from "../lib/srs";
import { MatchSheet } from "../components/MatchSheet";
import { DebriefModal } from "../components/DebriefModal";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Encore debout ? Pense à dormir 😴";
  if (h < 12) return "Bonjour ! Une belle journée de taupin t'attend ☀️";
  if (h < 18) return "Bon après-midi ! On garde le rythme 💪";
  return "Bonsoir ! Une dernière session avant de souffler ? 🌙";
}

export default function Dashboard() {
  const { tasks, evals, grades, sessions, lessons, club, settings, pronote, startTimer, timer } = useStore();
  const [editTask, setEditTask] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [editEval, setEditEval] = useState<Partial<Evaluation> | null>(null);
  const [debriefFor, setDebriefFor] = useState<Evaluation | null>(null);
  const toDebrief = evals.filter((e) => !e.debrief && daysUntil(e.date) < 0 && daysUntil(e.date) >= -7 && +new Date(e.date) < Date.now());

  const recos = useMemo(() => recommend(tasks, evals, grades).slice(0, 5), [tasks, evals, grades]);
  const unprepared = useMemo(() => unpreparedEvals(evals, tasks), [evals, tasks]);
  const upcoming = evals
    .filter((e) => daysUntil(e.date) >= 0)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 5);
  const todayIso = isoDay(new Date());
  const todayLessons = lessons.filter((l) => isoDay(l.start) === todayIso).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const todayItems = [
    ...evals.filter((e) => isoDay(e.date) === todayIso).map((e) => ({ id: e.id, start: e.date, label: e.subject, tag: e.type, room: e.room, color: "", canceled: false })),
    ...todayLessons.map((l) => ({ id: l.id, start: l.start, label: l.subject, tag: l.isTest ? "Éval" : "", room: l.room, color: l.color ?? subjectColor(l.subject), canceled: l.canceled })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const today = minutesByDay(sessions).get(todayIso) ?? 0;
  const table = standings(club.season);
  const rank = table.findIndex((r) => r.isUser) + 1;
  const next = upcoming[0];

  return (
    <>
      <div className="hero" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div>
            <h1 className="page-title">{greeting()}</h1>
            <p className="page-sub" style={{ margin: 0 }}>
              {pronote.user ? `${pronote.user.name} · ${pronote.user.className ?? ""}` : "Connecte Pronote dans les réglages pour tout importer automatiquement."}
            </p>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setEditTask({})}>+ Tâche</button>
            <button className="btn" onClick={() => setEditEval({})}>+ DS / khôlle</button>
            <button
              className="btn primary big" disabled={timer.status !== "idle"}
              onClick={() => { startTimer({ mode: "pomodoro", targetMin: settings.pomodoroWork, taskId: recos[0]?.task.id, subject: recos[0]?.task.subject }); navigate("focus"); }}
            >
              ▶ Lancer une session
            </button>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="row between small"><span>Objectif du jour</span><b>{fmtMin(today)} / {fmtMin(settings.dailyGoalMin)}</b></div>
          <Bar value={today} max={settings.dailyGoalMin} />
        </div>
      </div>

      <MatchSheet />

      <TodayStrip />

      <div className="grid g3">
        <div className="card span2">
          <h3>🧠 Quoi faire maintenant ? <span className="right muted small">trié par urgence, évals proches et matières faibles</span></h3>
          {toDebrief.length > 0 && (
            <div className="stack" style={{ marginBottom: 12 }}>
              {toDebrief.map((e) => (
                <div key={e.id} className="reco" style={{ borderColor: "#60a5fa66" }}>
                  <span style={{ fontSize: 20 }}>📝</span>
                  <div style={{ flex: 1 }}><b>{e.type} de {e.subject} {fmtRelDay(e.date)}</b> : 5 min de debrief à chaud, tes erreurs partent au carnet.</div>
                  <button className="btn sm gold" onClick={() => setDebriefFor(e)}>Debrief</button>
                </div>
              ))}
            </div>
          )}
          {unprepared.length > 0 && (
            <div className="stack" style={{ marginBottom: 12 }}>
              {unprepared.map((e) => (
                <div key={e.id} className="reco" style={{ borderColor: "#fbbf2466" }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <b>{e.type} de {e.subject} {fmtRelDay(e.date)}</b> et aucune tâche de préparation.
                    {e.topic && <div className="small muted">Programme : {e.topic}</div>}
                  </div>
                  <button className="btn sm gold" onClick={() => setEditTask({ title: `Préparer ${e.type.toLowerCase()} : ${e.topic ?? e.subject}`, subject: e.subject, evalId: e.id, kind: "revision", priority: 3, estimateMin: e.type === "DS" ? 180 : 60, due: isoDay(e.date) })}>
                    + Planifier
                  </button>
                </div>
              ))}
            </div>
          )}
          {recos.length === 0 ? (
            <div className="empty">Rien à faire ? Ajoute des tâches ou synchronise Pronote 🙌</div>
          ) : (
            <div className="stack">
              {recos.map((r, i) => (
                <div key={r.task.id} className="reco">
                  <span className="rank">{i + 1}</span>
                  <span className="subject-bar" style={{ background: subjectColor(r.task.subject) }} />
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setEditTask(r.task)}>
                    <div style={{ fontWeight: 600 }}>{r.task.title}</div>
                    <div className="small muted">{r.task.subject} · ~{fmtMin(r.task.estimateMin)} · {r.reasons.join(" · ")}</div>
                  </div>
                  <button className="btn sm" onClick={() => setCompleting(r.task)}>✓</button>
                  <button className="btn sm primary" disabled={timer.status !== "idle"} onClick={() => { startTimer({ mode: "pomodoro", targetMin: settings.pomodoroWork, taskId: r.task.id, subject: r.task.subject }); navigate("focus"); }}>▶</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>⏳ Prochaine échéance</h3>
          {next ? (
            <div className="stack">
              <div>
                <span className={`pill ${next.type === "DS" || next.type === "Concours blanc" ? "red" : "purple"}`}>{next.type}</span>{" "}
                <b style={{ fontSize: 18 }}>{next.subject}</b>
              </div>
              <Countdown date={next.date} />
              <div className="muted small">{fmtDay(next.date)} à {fmtTime(next.date)}{next.room ? ` · salle ${next.room}` : ""}{next.examiner ? ` · ${next.examiner}` : ""}</div>
              {next.topic && <div className="small">📚 {next.topic}</div>}
              <PrepProgress ev={next} />
              <hr className="sep" />
              <div className="list">
                {upcoming.slice(1).map((e) => (
                  <div key={e.id} className="row between small">
                    <span><span className={`pill ${e.type === "DS" ? "red" : "purple"}`}>{e.type}</span> {e.subject}</span>
                    <span className="muted">{fmtDay(e.date)} · {fmtRelDay(e.date)}</span>
                  </div>
                ))}
              </div>
              <button className="btn sm" onClick={() => navigate("evals")}>Tout voir →</button>
            </div>
          ) : (
            <div className="empty">Aucun DS ni khôlle prévu.<br /><button className="btn sm" style={{ marginTop: 8 }} onClick={() => setEditEval({})}>+ Ajouter</button></div>
          )}
        </div>

        <div className="card">
          <h3>📅 Aujourd'hui</h3>
          {todayItems.length === 0 ? (
            <div className="empty">Pas de cours aujourd'hui 🎉</div>
          ) : (
            <div className="list">
              {todayItems.map((it) => (
                <div key={it.id} className="row small" style={{ opacity: it.canceled ? 0.5 : 1, textDecoration: it.canceled ? "line-through" : "none" }}>
                  <b>{fmtTime(it.start)}</b>
                  {it.tag ? <span className="pill red">{it.tag}</span> : <span className="dot" style={{ background: it.color }} />}
                  {it.label}
                  {it.room && <span className="muted">· {it.room}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>⚽ {club.name}</h3>
          <div className="grid g2" style={{ gap: 10 }}>
            <div className="stat"><span className="v">{rank}<sup>e</sup></span><span className="l">{DIVISIONS[club.season.division]}</span></div>
            <div className="stat"><span className="v">{teamStrength(club.players).toFixed(1)}</span><span className="l">Note d'équipe</span></div>
          </div>
          <div className="small" style={{ marginTop: 12 }}>
            Prochain match : {Math.min(club.matchMinutesBank, MATCH_COST_MIN)}/{MATCH_COST_MIN} min de travail
          </div>
          <Bar value={Math.min(club.matchMinutesBank, MATCH_COST_MIN)} max={MATCH_COST_MIN} tone="blue" />
          <button className="btn sm" style={{ marginTop: 12 }} onClick={() => navigate("club")}>Aller au club →</button>
        </div>

        <div className="card">
          <h3>📌 Devoirs à rendre</h3>
          {(() => {
            const dues = tasks.filter((t) => !t.done && t.due && daysUntil(t.due) <= 7).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 6);
            return dues.length ? (
              <div className="list">
                {dues.map((t) => (
                  <div key={t.id} className="row small" style={{ cursor: "pointer" }} onClick={() => setCompleting(t)}>
                    <span className="check" />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    <span className={`pill ${daysUntil(t.due!) < 0 ? "red" : daysUntil(t.due!) <= 1 ? "gold" : ""}`}>{fmtRelDay(t.due!)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty">Rien dans les 7 prochains jours.</div>;
          })()}
        </div>
      </div>

      {editTask && <TaskForm initial={editTask} onClose={() => setEditTask(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
      {editEval && <EvalForm initial={editEval} onClose={() => setEditEval(null)} />}
      {debriefFor && <DebriefModal ev={debriefFor} onClose={() => setDebriefFor(null)} />}
    </>
  );
}

function TodayStrip() {
  const warmups = useStore((s) => s.warmups);
  const cards = useActiveCards();
  const reviews = useStore((s) => s.reviews);
  const toReview = buildQueue(cards, reviews, { newLimit: 20, max: 999, decks: ["actu", "bio", "mot", "anglais"] }).length;
  const test = nextTestDay();
  const dTest = daysUntil(test);
  const done = warmups.includes(isoDay(new Date()));
  return (
    <div className="grid g3" style={{ marginBottom: 16 }}>
      <button className="card" style={{ textAlign: "left", cursor: "pointer", borderColor: done ? undefined : "var(--accent)" }} onClick={() => navigate("warmup")}>
        <div className="row between"><b>🔥 Échauffement</b>{done ? <span className="pill green">fait ✓</span> : <span className="pill gold">à faire</span>}</div>
        <div className="small muted" style={{ marginTop: 6 }}>15 min : cartes + QCM d'anglais. Le meilleur moyen de lancer la journée.</div>
      </button>
      <button className="card" style={{ textAlign: "left", cursor: "pointer", borderColor: dTest <= 1 ? "var(--gold)" : undefined }} onClick={() => navigate("vendredi")}>
        <div className="row between"><b>🗞️ Test du vendredi</b><span className={`pill ${dTest <= 1 ? "gold" : ""}`}>{dTest === 0 ? "aujourd'hui" : dTest === 1 ? "demain" : `J-${dTest}`}</span></div>
        <div className="small muted" style={{ marginTop: 6 }}>{toReview} cartes à voir (actu, personnages, mots){dTest <= 1 ? " · lance le spécial veille de test" : ""}.</div>
      </button>
      <button className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate("edhec")}>
        <div className="row between"><b>🎯 EDHEC</b><span className="pill purple">J-{daysUntil(EDHEC_DATE)}</span></div>
        <div className="small muted" style={{ marginTop: 6 }}>Phase : {currentPhase().name}.</div>
      </button>
    </div>
  );
}

function Countdown({ date }: { date: string }) {
  const ms = +new Date(date) - Date.now();
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return <div className="countdown">{d > 0 ? `J-${d}` : "Aujourd'hui"} <span className="muted" style={{ fontSize: 16 }}>{d > 0 ? `${h}h` : fmtTime(date)}</span></div>;
}

function PrepProgress({ ev }: { ev: Evaluation }) {
  const allTasks = useStore((s) => s.tasks);
  const tasks = allTasks.filter((t) => t.evalId === ev.id);
  if (!tasks.length) return <div className="small muted">Aucune tâche de prépa liée.</div>;
  const done = tasks.filter((t) => t.done).length;
  return (
    <div>
      <div className="row between small"><span>Préparation</span><b>{done}/{tasks.length} tâches</b></div>
      <Bar value={done} max={tasks.length} tone="gold" />
    </div>
  );
}
