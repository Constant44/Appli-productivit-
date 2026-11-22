import { describe, expect, it } from "vitest";
import {
  replanDay, markDone,
  addActivity, deleteOccurrence, editOccurrence, expand, findOcc, keyOf, moveOccurrence, overdue, postpone, toggleDone, upsertExternal,
  type Activity, type Plan,
} from "./model";
import { computeReview } from "./review";
import { seedPlan } from "./seed";

const base = (acts: Activity[] = []): Plan => ({
  v: 2,
  categories: [
    { id: "maths", name: "Maths", color: "#00f", tracked: true },
    { id: "sport", name: "Sport", color: "#0f0", tracked: true },
    { id: "cours", name: "Cours", color: "#999", tracked: false },
  ],
  activities: acts, overrides: {}, done: {}, postponed: [], goals: [], reviews: {}, sleep: {}, prefs: { bedTarget: "23:15", wakeTarget: "07:15", dayEnd: "22:30" },
});
// série : maths lundi + jeudi 9 h–10 h à partir du lundi 23/11
const maths: Activity = { id: "m", title: "Maths", cat: "maths", prio: "important", date: "2026-11-23", start: "09:00", end: "10:00", repeat: { days: [0, 3], every: 1 }, check: true };
const W1 = ["2026-11-23", "2026-11-29"] as const;

describe("récurrence", () => {
  it("génère les occurrences sans jamais les dupliquer, même calculées plusieurs fois", () => {
    const p = base([maths]);
    const a = expand(p, ...W1);
    const b = expand(p, ...W1);
    expect(a.map((o) => o.date)).toEqual(["2026-11-23", "2026-11-26"]);
    expect(b).toEqual(a);
    expect(p.activities).toHaveLength(1);
  });
  it("une semaine sur deux et vacances sautées", () => {
    const esp: Activity = { id: "e", title: "Esp", cat: "cours", prio: "fixe", date: "2026-11-25", start: "14:00", end: "16:00", repeat: { days: [2], every: 2, skipHolidays: true }, check: false };
    const dates = expand(base([esp]), "2026-11-23", "2027-01-15").map((o) => o.date);
    expect(dates).toEqual(["2026-11-25", "2026-12-09", "2027-01-06"]); // 23/12 = vacances
  });
  it("le passage d'un mois à l'autre ne fait rien disparaître", () => {
    const p = base([maths]);
    const nov = expand(p, "2026-11-01", "2026-11-30").length;
    const dec = expand(p, "2026-12-01", "2026-12-31").length;
    expect(expand(p, "2026-11-01", "2026-12-31")).toHaveLength(nov + dec);
  });
});

describe("modifier", () => {
  it("modifier UNE occurrence ne touche pas le reste de la série", () => {
    let p = base([maths]);
    p = editOccurrence(p, keyOf("m", "2026-11-26"), { title: "Maths : khôlle", start: "17:00", end: "18:00" }, "one");
    const [lun, jeu] = expand(p, ...W1);
    expect(lun.title).toBe("Maths");
    expect(jeu).toMatchObject({ title: "Maths : khôlle", start: "17:00", date: "2026-11-26" });
    expect(expand(p, "2026-11-30", "2026-12-06").every((o) => o.title === "Maths")).toBe(true);
  });
  it("modifier celle-ci et les suivantes coupe la série sans changer le passé (validations conservées)", () => {
    let p = base([maths]);
    p = toggleDone(p, keyOf("m", "2026-11-23"));
    p = toggleDone(p, keyOf("m", "2026-12-03"));
    p = editOccurrence(p, keyOf("m", "2026-11-30"), { start: "14:00", end: "15:30" }, "following");
    const occ = expand(p, "2026-11-23", "2026-12-06");
    expect(occ.map((o) => `${o.date} ${o.start}`)).toEqual(["2026-11-23 09:00", "2026-11-26 09:00", "2026-11-30 14:00", "2026-12-03 14:00"]);
    expect(occ[0].done).toBeTruthy(); // passé : intact
    expect(occ[3].done).toBeTruthy(); // validation suivie dans la nouvelle série
    expect(p.activities).toHaveLength(2);
  });
  it("modifier toute la série", () => {
    let p = base([maths]);
    p = editOccurrence(p, keyOf("m", "2026-11-26"), { cat: "sport", prio: "facultatif" }, "all");
    expect(expand(p, ...W1).every((o) => o.cat === "sport" && o.prio === "facultatif")).toBe(true);
  });
  it("ponctuelle → récurrente puis récurrente → ponctuelle", () => {
    const once: Activity = { id: "o", title: "Lecture", cat: "sport", prio: "facultatif", date: "2026-11-24", start: "22:00", end: "22:30", check: true };
    let p = toggleDone(base([once]), keyOf("o", "1"));
    p = editOccurrence(p, keyOf("o", "1"), { repeat: { days: [1, 3], every: 1 } }, "all");
    const occ = expand(p, ...W1);
    expect(occ.map((o) => o.date)).toEqual(["2026-11-24", "2026-11-26"]);
    expect(occ[0].done).toBeTruthy();
    p = editOccurrence(p, keyOf("o", "2026-11-26"), { repeat: null }, "following");
    const after = expand(p, "2026-11-23", "2026-12-06");
    expect(after.map((o) => `${o.date}${o.series ? "R" : "P"}`)).toEqual(["2026-11-24R", "2026-11-26P"]);
  });
});

describe("déplacer, supprimer, reporter", () => {
  it("glisser une occurrence vers un autre jour et une autre heure garde sa durée", () => {
    let p = base([maths]);
    p = moveOccurrence(p, keyOf("m", "2026-11-23"), "2026-11-25", "15:30");
    const o = expand(p, ...W1).find((x) => x.orig === "2026-11-23")!;
    expect(o).toMatchObject({ date: "2026-11-25", start: "15:30", end: "16:30", moved: true });
    // une occurrence déplacée dans une autre semaine apparaît dans cette semaine-là
    p = moveOccurrence(p, keyOf("m", "2026-11-26"), "2026-12-01");
    expect(expand(p, "2026-11-30", "2026-12-06").map((x) => x.orig)).toContain("2026-11-26");
    expect(expand(p, ...W1).map((x) => x.orig)).not.toContain("2026-11-26");
  });
  it("supprimer une occurrence, les suivantes, ou toute la série", () => {
    const p = base([maths]);
    expect(expand(deleteOccurrence(p, keyOf("m", "2026-11-26"), "one"), ...W1).map((o) => o.date)).toEqual(["2026-11-23"]);
    const f = deleteOccurrence(p, keyOf("m", "2026-11-30"), "following");
    expect(expand(f, "2026-11-23", "2026-12-31").map((o) => o.date)).toEqual(["2026-11-23", "2026-11-26"]);
    expect(deleteOccurrence(p, keyOf("m", "2026-11-26"), "all").activities).toHaveLength(0);
  });
  it("une séance non faite n'est jamais validée toute seule ; on la reporte à la main", () => {
    let p = base([maths]);
    expect(overdue(p, "2026-11-27").map((o) => o.date)).toEqual(["2026-11-23", "2026-11-26"]);
    p = postpone(p, keyOf("m", "2026-11-23"), "2026-11-28");
    expect(overdue(p, "2026-11-27").map((o) => o.date)).toEqual(["2026-11-26"]);
    expect(findOcc(p, keyOf("m", "2026-11-23"))).toMatchObject({ date: "2026-11-28", done: undefined });
    expect(p.postponed).toHaveLength(1);
  });
  it("l'import de l'agenda ajoute sans dupliquer ni écraser une modification manuelle", () => {
    const k: Activity = { id: "gcal-1", title: "Khôlle", cat: "cours", prio: "fixe", date: "2026-11-24", start: "18:00", end: "19:00", check: false, source: "gcal" };
    let p = upsertExternal(base(), [k]);
    p = upsertExternal(p, [k]);
    expect(p.activities).toHaveLength(1);
    p = editOccurrence(p, keyOf("gcal-1", "1"), { start: "17:00", end: "18:00" }, "one");
    p = upsertExternal(p, [{ ...k, title: "Khôlle (salle F104)" }]);
    expect(p.activities[0]).toMatchObject({ start: "17:00", title: "Khôlle" });
  });
});

describe("bilan de la semaine", () => {
  it("ne compte que les séances validées, détaille les séances manquées et les reports", () => {
    let p = addActivity(base([maths]), { id: "s", title: "Sport", cat: "sport", prio: "important", date: "2026-11-24", start: "16:00", end: "17:00", check: true });
    p = toggleDone(p, keyOf("m", "2026-11-23"), 45); // 45 min réellement faites
    p = postpone(p, keyOf("s", "1"), "2026-11-28");
    const r = computeReview(p, "2026-11-23", "2026-12-01");
    const m = r.lines.find((l) => l.cat === "maths")!;
    expect(m).toMatchObject({ plannedMin: 120, doneMin: 45, pct: 38, doneCount: 1 });
    expect(m.missed.map((x) => x.date)).toEqual(["2026-11-26"]);
    expect(r.totals).toMatchObject({ plannedMin: 180, doneMin: 45, tasksDone: 1, tasksLeft: 2, postponed: 1 });
    expect(r.insights[0]).toContain("45 min");
    expect(r.insights.join(" ")).toContain("Aucune séance de Sport validée");
  });
  it("le planning de départ : aucune occurrence en double, échéances présentes", () => {
    const p = seedPlan();
    const week = expand(p, "2026-11-23", "2026-11-29");
    const keys = week.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(week.some((o) => o.title.startsWith("Khôlle de maths"))).toBe(true);
    expect(week.some((o) => o.title.includes("préparer la khôlle"))).toBe(true);
    // ~18-22 h de travail perso prévues (hors cours, repas, routines)
    const work = week.filter((o) => o.check && !["vie", "lecture", "sport", "anki", "actu"].includes(o.cat)).reduce((s, o) => s + o.minutes, 0) / 60;
    expect(work).toBeGreaterThan(14);
    expect(work).toBeLessThan(24);
  });
});

describe("replanifier la journée", () => {
  const day = "2026-11-23";
  const T = (id: string, start: string, end: string, prio: Activity["prio"] = "important", extra: Partial<Activity> = {}): Activity =>
    ({ id, title: id, cat: "maths", prio, date: day, start, end, check: true, ...extra });
  it("réveillé à 11 h : les séances manquées se recalent après, autour du déjeuner, sans jamais avancer une séance", () => {
    const p = base([
      T("a", "09:15", "10:00"), T("b", "10:10", "10:55"),
      { id: "dej", title: "Déjeuner", cat: "cours", prio: "fixe", date: day, start: "12:30", end: "13:15", check: false },
      T("c", "13:30", "14:15"), T("d", "17:30", "18:15", "facultatif"),
    ]);
    const r = replanDay(p, day, 11 * 60 + 2);
    const at = (id: string) => findOcc(r.plan, keyOf(id, "1"))!.start;
    // a dans le trou de 11 h ; b ne tient pas avant le déjeuner ni avant c : il passe après c ; c et d ne bougent pas
    expect([at("a"), at("b"), at("c"), at("d")]).toEqual(["11:05", "14:20", "13:30", "17:30"]);
    expect(r.overflow).toHaveLength(0);
    expect(r.moves.map((m) => m.key)).toEqual(["a@1", "b@1"]);
  });
  it("pas assez de place : le prévu à venir tient, le manqué part au report", () => {
    const p = base([T("a", "09:00", "10:00"), T("opt", "20:00", "21:00", "facultatif"), T("b", "21:00", "22:00")]);
    const r = replanDay(p, day, 20 * 60 + 30);
    expect(r.overflow.map((o) => o.id).sort()).toEqual(["a", "opt"].sort());
    expect(findOcc(r.plan, keyOf("b", "1"))!.start).toBe("21:00");
  });
  it("une séance importante manquée prend la place d'une séance facultative à venir", () => {
    const p = base([T("a", "09:00", "09:45"), T("opt", "18:00", "18:45", "facultatif"), T("b", "19:00", "22:20")]);
    const r = replanDay(p, day, 17 * 60 + 55);
    expect(findOcc(r.plan, keyOf("a", "1"))!.start).toBe("17:55");
    expect(r.overflow.map((o) => o.id)).toEqual(["opt"]);
  });
  it("une séance validée en mode Focus garde sa durée réelle et les décrochages", () => {
    const p = markDone(base([maths]), keyOf("m", "2026-11-23"), 38.4, { focus: true, distractions: 2 });
    expect(p.done[keyOf("m", "2026-11-23")]).toMatchObject({ minutes: 38, focus: true, distractions: 2 });
  });
});
