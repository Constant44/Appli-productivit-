import { useMemo, useState } from "react";
import { useActiveCards, useStore } from "../lib/store";
import { recommend, unpreparedEvals, minutesByDay } from "../lib/insights";
import { daysUntil, fmtDay, fmtMin, fmtRelDay, fmtTime, isoDay, subjectColor } from "../lib/utils";
import type { Evaluation, Task } from "../lib/types";
import { CompleteTaskModal, EvalForm, TaskForm } from "../components/forms";
import { navigate } from "../App";
import { EDHEC_DATE, currentPhase } from "./Edhec";
import { buildQueue, nextTestDay } from "../lib/srs";
import { MatchSheet } from "../components/MatchSheet";
import { DebriefModal } from "../components/DebriefModal";
import { Rat, useMood } from "../components/Mascot";
import { City, useCityStats } from "../components/City";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Écran d'accueil épuré : la mascotte, le coup d'envoi, trois tuiles, ce qui presse, la ville. */
export default function Dashboard() {
  const { tasks, evals, grades, sessions, settings, club } = useStore();
  const [editTask, setEditTask] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [editEval, setEditEval] = useState<Partial<Evaluation> | null>(null);
  const [debriefFor, setDebriefFor] = useState<Evaluation | null>(null);
  const mood = useMood();

  const now = new Date();
  const recos = useMemo(() => recommend(tasks, evals, grades).slice(0, 3), [tasks, evals, grades]);
  const unprepared = useMemo(() => unpreparedEvals(evals, tasks).slice(0, 2), [evals, tasks]);
  const toDebrief = evals.filter((e) => !e.debrief && daysUntil(e.date) < 0 && daysUntil(e.date) >= -7 && +new Date(e.date) < Date.now()).slice(0, 2);
  const upcoming = evals.filter((e) => +new Date(e.date) >= Date.now() - 36e5).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const today = minutesByDay(sessions).get(isoDay(now)) ?? 0;
  const left = Math.max(0, settings.dailyGoalMin - today);
  const bubble =
    mood === "sleep" ? "Zzz… Lance le coup d'envoi pour me réveiller."
    : mood === "run" ? "Allez, on lâche rien ! 💨"
    : mood === "cheer" ? `Objectif atteint : ${fmtMin(today)} aujourd'hui. Fromage mérité ! 🧀`
    : `${fmtMin(today)} aujourd'hui · encore ${fmtMin(left)} pour l'objectif.`;

  return (
    <>
      <header className="today-head">
        <div>
          <div className="eyebrow">{DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}</div>
          <h1 className="page-title">{now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir"} 👋</h1>
          <div className="bubble">{bubble}</div>
        </div>
        <Rat mood={mood} size={128} jersey={club.colorA} trim={club.colorB} />
      </header>

      <MatchSheet />

      <TodayTiles />

      {(toDebrief.length > 0 || unprepared.length > 0) && (
        <div className="stack" style={{ marginBottom: 16 }}>
          {toDebrief.map((e) => (
            <button key={e.id} className="alert blue" onClick={() => setDebriefFor(e)}>
              <span>📝</span><span><b>Debrief : {e.type} de {e.subject}</b> {fmtRelDay(e.date)} · 5 min, tes erreurs partent au carnet</span><span className="go">→</span>
            </button>
          ))}
          {unprepared.map((e) => (
            <button key={e.id} className="alert gold" onClick={() => setEditTask({ title: `Préparer ${e.type.toLowerCase()} : ${e.topic ?? e.subject}`, subject: e.subject, evalId: e.id, kind: "revision", priority: 3, estimateMin: e.type === "DS" ? 180 : 60, due: isoDay(e.date) })}>
              <span>⚠️</span><span><b>{e.type} de {e.subject} {fmtRelDay(e.date)}</b> · aucune tâche de préparation</span><span className="go">+ Planifier</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <section className="card">
          <h3>À faire <button className="btn sm ghost right" onClick={() => setEditTask({})}>+ Tâche</button></h3>
          {recos.length === 0 ? (
            <div className="empty">Rien en attente. Ajoute une tâche ou profite 🙌</div>
          ) : (
            <div className="list">
              {recos.map((r) => (
                <div key={r.task.id} className="todo">
                  <button className="check" aria-label="Terminer" onClick={() => setCompleting(r.task)} />
                  <span className="subject-bar" style={{ background: subjectColor(r.task.subject) }} />
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => setEditTask(r.task)}>
                    <div className="title">{r.task.title}</div>
                    <div className="small muted">{r.task.subject} · ~{fmtMin(r.task.estimateMin)}{r.reasons[0] ? ` · ${r.reasons[0]}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => navigate("tasks")}>Toute la to-do →</button>
        </section>

        <section className="card">
          <h3>Prochaines échéances <button className="btn sm ghost right" onClick={() => setEditEval({})}>+ DS / khôlle</button></h3>
          {upcoming.length === 0 ? (
            <div className="empty">Aucun DS ni khôlle prévu.</div>
          ) : (
            <div className="list">
              {upcoming.map((e) => {
                const d = daysUntil(e.date);
                return (
                  <div key={e.id} className="deadline">
                    <div className={`when ${d <= 1 ? "hot" : ""}`}><b>{d <= 0 ? "Auj." : `J-${d}`}</b><span>{fmtTime(e.date)}</span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title"><span className={`pill ${e.type === "DS" ? "red" : "purple"}`}>{e.type}</span> {e.subject}</div>
                      <div className="small muted">{fmtDay(e.date)}{e.examiner ? ` · ${e.examiner}` : ""}{e.room ? ` · ${e.room}` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => navigate("evals")}>Tout voir →</button>
        </section>
      </div>

      <CityTeaser />

      {editTask && <TaskForm initial={editTask} onClose={() => setEditTask(null)} />}
      {completing && <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />}
      {editEval && <EvalForm initial={editEval} onClose={() => setEditEval(null)} />}
      {debriefFor && <DebriefModal ev={debriefFor} onClose={() => setDebriefFor(null)} />}
    </>
  );
}

function TodayTiles() {
  const warmups = useStore((s) => s.warmups);
  const cards = useActiveCards();
  const reviews = useStore((s) => s.reviews);
  const toReview = buildQueue(cards, reviews, { newLimit: 20, max: 999, decks: ["actu", "bio", "mot", "anglais", "erreur"] }).length;
  const dTest = daysUntil(nextTestDay());
  const done = warmups.includes(isoDay(new Date()));
  return (
    <div className="tiles">
      <button className={`tile ${done ? "ok" : "need"}`} onClick={() => navigate("warmup")}>
        <span className="tile-ico">🔥</span>
        <b>Échauffement</b>
        <span>{done ? "fait ✓" : "15 min · à faire"}</span>
      </button>
      <button className={`tile ${dTest <= 1 ? "need" : ""}`} onClick={() => navigate("vendredi")}>
        <span className="tile-ico">🗞️</span>
        <b>Test du vendredi</b>
        <span>{dTest === 0 ? "aujourd'hui" : dTest === 1 ? "demain" : `J-${dTest}`} · {toReview} cartes</span>
      </button>
      <button className="tile" onClick={() => navigate("edhec")}>
        <span className="tile-ico">🎯</span>
        <b>EDHEC</b>
        <span>J-{daysUntil(EDHEC_DATE)} · {currentPhase().name.split(" (")[0]}</span>
      </button>
    </div>
  );
}

function CityTeaser() {
  const s = useCityStats();
  return (
    <section className="card city-teaser" onClick={() => navigate("club")}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>🏙️ Prépa City</h3>
        <span className="small muted">{s.hours.toFixed(0)} h de travail · BU {s.bu}/7 · tour EDHEC {Math.round(s.p * 100)} %</span>
      </div>
      <City compact onOpen={() => navigate("club")} />
    </section>
  );
}
