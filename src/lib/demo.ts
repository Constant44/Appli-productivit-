/** Données de démonstration (pour tester l'appli sans Pronote). */
import type { Evaluation, Grade, Lesson, Plan, Session, Task } from "./types";
import { applyTraining, initialClub } from "./game";
import { addDays, isoDay, rng, startOfWeek, uid } from "./utils";

export function demoData() {
  const r = rng(2026);
  const now = new Date();
  const monday = startOfWeek(now);
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = addDays(monday, dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // Emploi du temps type D2 sur 3 semaines
  const week: Array<[number, number, number, string, string, string]> = [
    [0, 8, 10, "Maths", "M. Laplace", "B204"],
    [0, 10, 12, "Économie", "Mme Walras", "A102"],
    [0, 14, 16, "Droit", "M. Portalis", "A102"],
    [1, 8, 10, "Gestion", "Mme Fayol", "C12"],
    [1, 10, 12, "Maths", "M. Laplace", "B204"],
    [1, 13, 15, "Anglais", "Mrs Austen", "L3"],
    [2, 8, 11, "Économie", "Mme Walras", "A102"],
    [2, 11, 12, "Culture générale", "M. Bergson", "A001"],
    [3, 8, 10, "Droit", "M. Portalis", "A102"],
    [3, 10, 12, "Maths", "M. Laplace", "B204"],
    [3, 14, 16, "LV2", "Sr. Cervantes", "L5"],
    [4, 8, 10, "Gestion", "Mme Fayol", "C12"],
    [4, 10, 12, "Économie", "Mme Walras", "A102"],
  ];
  const lessons: Lesson[] = [];
  for (let w = -1; w <= 2; w++)
    for (const [d, h1, h2, subject, teacher, room] of week)
      lessons.push({
        id: uid(), start: at(d + 7 * w, h1), end: at(d + 7 * w, h2), subject, teacher, room,
        canceled: false, isTest: false, kind: "lesson",
      });
  // DS du samedi matin marqué dans Pronote (les deux premiers sont saisis à la main plus bas)
  lessons.push({
    id: uid(), start: at(19, 8), end: at(19, 12), subject: "Droit", canceled: false, isTest: true, kind: "lesson", room: "Amphi",
  });

  const evals: Evaluation[] = [
    { id: uid(), type: "DS", subject: "Maths", date: at(5, 8), durationMin: 240, topic: "Algèbre linéaire, réduction", source: "manual" },
    { id: uid(), type: "DS", subject: "Économie", date: at(12, 8), durationMin: 240, topic: "Croissance & fluctuations", source: "manual" },
    { id: uid(), type: "Khôlle", subject: "Maths", date: at(1, 17), durationMin: 60, topic: "Probabilités discrètes", examiner: "M. Bernoulli", room: "B12", source: "manual" },
    { id: uid(), type: "Khôlle", subject: "Anglais", date: at(3, 17), durationMin: 30, topic: "Press review", examiner: "Mrs Woolf", room: "L2", source: "manual" },
    { id: uid(), type: "Khôlle", subject: "Économie", date: at(8, 18), durationMin: 60, topic: "Marché du travail", examiner: "M. Phillips", room: "A3", source: "manual" },
    { id: uid(), type: "Khôlle", subject: "Droit", date: at(-4, 17), durationMin: 60, topic: "Sources du droit", examiner: "Mme Carbonnier", source: "manual", result: 13, rewarded: true },
    { id: uid(), type: "DS", subject: "Gestion", date: at(-2, 8), durationMin: 180, topic: "Analyse financière", source: "manual", result: 11.5, rewarded: true },
  ];
  const plan: Plan = {
    id: uid(), name: "Révisions DS de maths + éco", start: isoDay(now), end: isoDay(addDays(now, 12)), dailyMin: 150, daysOff: [0],
  };

  const T = (t: Partial<Task> & Pick<Task, "title" | "subject" | "estimateMin">): Task => ({
    id: uid(), kind: "devoir", priority: 2, done: false, createdAt: new Date().toISOString(), source: "manual", ...t,
  });
  const tasks: Task[] = [
    T({ title: "Exos 12 à 18 feuille réduction", subject: "Maths", estimateMin: 90, due: isoDay(addDays(now, 2)), kind: "exercices" }),
    T({ title: "Fiche : théorème spectral + diagonalisation", subject: "Maths", estimateMin: 45, kind: "fiche", planId: plan.id, evalId: evals[0].id, priority: 3 }),
    T({ title: "Refaire DS 2 (partie B)", subject: "Maths", estimateMin: 120, kind: "revision", planId: plan.id, evalId: evals[0].id }),
    T({ title: "Lire chap. 4 Solow + fiche", subject: "Économie", estimateMin: 75, kind: "fiche", planId: plan.id, evalId: evals[1].id }),
    T({ title: "Dissertation blanche : « La croissance est-elle soutenable ? »", subject: "Économie", estimateMin: 180, kind: "revision", planId: plan.id, evalId: evals[1].id, priority: 3 }),
    T({ title: "Commentaire d'arrêt (TD 5)", subject: "Droit", estimateMin: 120, due: isoDay(addDays(now, 4)) }),
    T({ title: "Vocab unit 6 + press review", subject: "Anglais", estimateMin: 40, evalId: evals[3].id, kind: "revision" }),
    T({ title: "Cas pratique coûts complets", subject: "Gestion", estimateMin: 60, due: isoDay(addDays(now, 6)) }),
    T({ title: "Méthode probas : lois usuelles", subject: "Maths", estimateMin: 50, evalId: evals[2].id, kind: "fiche", priority: 3 }),
    T({ title: "Sport 🏃", subject: "Perso", estimateMin: 60, kind: "perso", priority: 1 }),
  ];

  // Historique : tâches terminées avec estimation vs réel (sous-estimation en maths, ok en éco)
  const history: Array<[string, string, number, number]> = [
    ["Exos intégrales", "Maths", 60, 95],
    ["Fiche séries", "Maths", 40, 55],
    ["DM 3", "Maths", 120, 170],
    ["Exos espaces vectoriels", "Maths", 60, 80],
    ["Fiche keynésianisme", "Économie", 60, 65],
    ["Lecture Piketty chap. 1", "Économie", 45, 40],
    ["Dissert chômage", "Économie", 150, 165],
    ["Fiche contrats", "Droit", 45, 70],
    ["Commentaire d'arrêt TD4", "Droit", 90, 130],
    ["Vocab unit 5", "Anglais", 30, 30],
    ["Bilan & compte de résultat", "Gestion", 60, 75],
  ];
  const sessions: Session[] = [];
  history.forEach(([title, subject, est, act], i) => {
    const t = T({ title, subject, estimateMin: est, done: true, rewarded: true });
    const day = addDays(now, -14 + i);
    t.doneAt = day.toISOString();
    tasks.push(t);
    let left = act;
    while (left > 0) {
      const m = Math.min(left, 50);
      const st = new Date(day);
      st.setHours(17 + Math.floor(r() * 4), Math.floor(r() * 60));
      sessions.push({ id: uid(), taskId: t.id, subject, start: st.toISOString(), minutes: m, focus: 3 + Math.floor(r() * 3), xp: m * 10, coins: m * 10 });
      left -= m;
    }
  });
  // Quelques sessions libres récentes pour une série
  for (let i = 1; i <= 5; i++) {
    const st = addDays(now, -i);
    st.setHours(20, 0);
    sessions.push({ id: uid(), subject: "Maths", start: st.toISOString(), minutes: 40 + Math.floor(r() * 40), focus: 4, xp: 500, coins: 500 });
  }

  const g = (subject: string, value: number, outOf: number, coefficient: number, daysAgo: number, label: string, classAverage?: number): Grade => ({
    id: uid(), subject, value, outOf, coefficient, date: addDays(now, -daysAgo).toISOString(), label, classAverage, source: "manual",
  });
  const grades: Grade[] = [
    g("Maths", 8.5, 20, 2, 30, "DS 1", 9.2), g("Maths", 11, 20, 2, 16, "DS 2", 9.8), g("Maths", 12, 20, 1, 9, "Khôlle"),
    g("Économie", 13, 20, 2, 28, "Dissert 1", 10.5), g("Économie", 14.5, 20, 1, 12, "Khôlle"),
    g("Droit", 10, 20, 2, 25, "DS 1", 10.1), g("Droit", 13, 20, 1, 4, "Khôlle — Sources du droit"),
    g("Gestion", 11.5, 20, 2, 2, "DS — Analyse financière", 10.9),
    g("Anglais", 15, 20, 1, 20, "Colle"), g("Culture générale", 9, 20, 2, 18, "Dissert", 8.7),
  ];

  const minutes = sessions.reduce((a, b) => a + b.minutes, 0);
  const club = initialClub("Prépa FC");
  club.matchMinutesBank = 200;
  club.players = applyTraining(club.players, minutes / 60, 0).players;

  return {
    tasks, evals, sessions, grades, lessons, plans: [plan], club,
    xp: sessions.reduce((a, b) => a + b.xp, 0),
    coins: 2400,
  };
}
