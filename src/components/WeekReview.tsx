/** Bilan de la semaine : temps de travail, programme tenu, révisions, notes, et la semaine qui vient. */
import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { askJson, AiError, useAi } from "../lib/ai";
import { addDays, fmtDay, fmtMin, isoDay, startOfDay, subjectColor } from "../lib/utils";

/** Lundi de la semaine de `d`. */
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

export function useWeekStats(offsetWeeks = 0) {
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const reviews = useStore((s) => s.reviews);
  const grades = useStore((s) => s.grades);
  const english = useStore((s) => s.edhec.english);
  return useMemo(() => {
    const from = addDays(mondayOf(new Date()), 7 * offsetWeeks);
    const a = isoDay(from), b = isoDay(addDays(from, 6));
    const inWeek = (iso?: string) => !!iso && iso.slice(0, 10) >= a && iso.slice(0, 10) <= b;
    const ss = sessions.filter((x) => inWeek(isoDay(x.start)));
    const minutes = ss.reduce((t, x) => t + x.minutes, 0);
    const bySubject = new Map<string, number>();
    for (const x of ss) bySubject.set(x.subject || "Autre", (bySubject.get(x.subject || "Autre") ?? 0) + x.minutes);
    const prog = tasks.filter((t) => t.plannedFor && t.plannedFor >= a && t.plannedFor <= b && t.plannedFor <= isoDay(new Date()));
    const progDone = prog.filter((t) => t.done).reduce((t, x) => t + x.estimateMin, 0);
    const progAll = prog.reduce((t, x) => t + x.estimateMin, 0);
    const done = tasks.filter((t) => t.done && inWeek(t.doneAt)).length;
    const cards = Object.values(reviews).filter((r) => inWeek(r.last)).length;
    const newGrades = grades.filter((g) => inWeek(g.date));
    const blancs = english.filter((r) => r.mode === "blanc" && inWeek(r.date));
    const days = new Set(ss.map((x) => isoDay(x.start))).size;
    return { a, b, minutes, days, bySubject: [...bySubject.entries()].sort((x, y) => y[1] - x[1]), progDone, progAll, done, cards, newGrades, blancs };
  }, [sessions, tasks, reviews, grades, english, offsetWeeks]);
}

export function WeekReview({ compact }: { compact?: boolean }) {
  const cur = useWeekStats(0);
  const prev = useWeekStats(-1);
  const evals = useStore((s) => s.evals);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const ai = useAi((s) => s.available);
  const [coach, setCoach] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const coming = useMemo(() => {
    const now = Date.now(), end = now + 7 * 864e5;
    return evals.filter((e) => +new Date(e.date) >= now && +new Date(e.date) <= end).sort((x, y) => x.date.localeCompare(y.date));
  }, [evals]);
  const delta = cur.minutes - prev.minutes;
  const progPct = cur.progAll ? Math.round((cur.progDone / cur.progAll) * 100) : null;
  const maxSub = cur.bySubject[0]?.[1] ?? 1;

  const ask = async () => {
    setBusy(true); setError("");
    try {
      const r = await askJson<{ conseils: string[] }>(
        `Tu es le coach de travail d'un étudiant de prépa D2 qui prépare les écrits du concours EDHEC Pré-Master (3 avril 2027 : microéconomie coef 5, synthèse, anglais LV1). Voici sa semaine, en données brutes :
- Travail chronométré : ${fmtMin(cur.minutes)} sur ${cur.days} jours (semaine précédente : ${fmtMin(prev.minutes)}). Objectif quotidien : ${fmtMin(goal)}.
- Par matière : ${cur.bySubject.map(([s, m]) => `${s} ${fmtMin(m)}`).join(", ") || "rien"}.
- Programme quotidien tenu : ${progPct ?? "?"} % (${fmtMin(cur.progDone)} sur ${fmtMin(cur.progAll)} prévues jusqu'à aujourd'hui).
- Tâches terminées : ${cur.done}. Cartes révisées : ${cur.cards}. QCM blancs d'anglais : ${cur.blancs.map((x) => `${((x.score / x.total) * 20).toFixed(1)}/20`).join(", ") || "aucun"}.
- Nouvelles notes : ${cur.newGrades.map((g) => `${g.subject} ${g.value}/${g.outOf}`).join(", ") || "aucune"}.
- Semaine prochaine : ${coming.map((e) => `${e.type} de ${e.subject} le ${fmtDay(e.date)}${e.topic ? ` (${e.topic})` : ""}`).join(" ; ") || "rien de prévu"}.
Donne exactement 3 conseils concrets et chiffrés pour la semaine qui vient, en français, tutoiement, une phrase chacun, sans flatterie. Réponds en JSON : {"conseils": ["…", "…", "…"]}`,
        { tier: "quick", fresh: true },
      );
      setCoach(r.conseils.slice(0, 3));
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card week-review">
      <h3>📊 Ta semaine <span className="small muted right">{fmtDay(`${cur.a}T12:00:00`)} → {fmtDay(`${cur.b}T12:00:00`)}</span></h3>
      <div className="wr-kpis">
        <div><b>{fmtMin(cur.minutes)}</b><span>travaillées · {delta === 0 ? "comme la semaine passée" : `${delta > 0 ? "+" : "−"}${fmtMin(Math.abs(delta))} vs sem. passée`}</span></div>
        <div><b>{progPct == null ? "—" : `${progPct} %`}</b><span>du programme tenu</span></div>
        <div><b>{cur.cards}</b><span>cartes révisées</span></div>
        <div><b>{cur.done}</b><span>tâches terminées</span></div>
      </div>
      {!compact && cur.bySubject.length > 0 && (
        <div className="theme-bars" style={{ marginTop: 12 }}>
          {cur.bySubject.slice(0, 6).map(([s, m]) => (
            <div key={s} className="theme-bar">
              <span>{s}</span>
              <div className="bar"><div style={{ width: `${(m / maxSub) * 100}%`, background: subjectColor(s) }} /></div>
              <b>{fmtMin(m)}</b>
            </div>
          ))}
        </div>
      )}
      {!compact && cur.newGrades.length > 0 && (
        <div className="small" style={{ marginTop: 10 }}>📝 Notes de la semaine : {cur.newGrades.map((g) => `${g.subject.split(" › ")[0]} ${g.value}/${g.outOf}`).join(" · ")}</div>
      )}
      <div className="small" style={{ marginTop: 10 }}>
        <b>Semaine qui vient :</b> {coming.length ? coming.map((e) => `${e.type} de ${e.subject} (${fmtDay(e.date)})`).join(" · ") : "pas de DS ni de khôlle"}
      </div>
      {coach && <ul className="wr-coach">{coach.map((c, k) => <li key={k}>{c}</li>)}</ul>}
      {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
      {ai !== false && !coach && <button className="btn sm" style={{ marginTop: 10 }} disabled={busy} onClick={ask}>{busy ? "Claude analyse ta semaine…" : "✨ 3 conseils pour la semaine prochaine"}</button>}
    </section>
  );
}
