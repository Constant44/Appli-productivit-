import { describe, expect, it } from "vitest";
import { deleteOccurrence, expand, keyOf, normalize, upsertExternal, type Activity, type Plan } from "./model";
import { seedPlan } from "./seed";
import { sleepStats } from "./coach";
import { isUngraded } from "./grades";
import {
  eveningExpected, isDone, lectureOcc, lightsOut, nightPending, progressOf, reportBed, reportLecture, stepClock, toggleStep, wakeAt,
} from "./routine";

const plan = () => normalize(seedPlan());

describe("routines : ancres du jour", () => {
  it("le lever suit la routine du matin du jour, l'extinction suit la lecture du soir", () => {
    const p = plan();
    expect(wakeAt(p, "2026-11-24")).toBe("07:15"); // mardi : cours à 8 h
    expect(wakeAt(p, "2026-11-23")).toBe("08:00"); // lundi : BU à 9 h
    expect(wakeAt(p, "2026-11-28")).toBe("10:00"); // samedi
    expect(lightsOut(p, "2026-11-22")).toBe("23:15"); // dimanche soir
    expect(stepClock("23:15", -45)).toBe("22:30");
    expect(stepClock("23:15", 75)).toBe("00:30");
  });

  it("le soir n'est cadré que si le lendemain commence tôt (vendredi et samedi soir libres)", () => {
    const p = plan();
    expect(eveningExpected(p, "2026-11-22")).toBe(true); // dimanche → lundi 8 h
    expect(eveningExpected(p, "2026-11-25")).toBe(true); // mercredi → jeudi 8 h
    expect(eveningExpected(p, "2026-11-27")).toBe(false); // vendredi → samedi 10 h
    expect(eveningExpected(p, "2026-11-28")).toBe(false); // samedi → dimanche 10 h
  });
});

describe("routines : cocher les étapes", () => {
  it("cocher « Debout » note l'heure de lever ; décocher l'efface", () => {
    const at = new Date(2026, 10, 24, 7, 18);
    let p = toggleStep(plan(), "2026-11-24", "matin", "m-up", at);
    expect(isDone(p, "2026-11-24", "matin", "m-up")).toBe(true);
    expect(p.sleep["2026-11-24"].wake).toBe(at.toISOString());
    expect(progressOf(p, "2026-11-24", "matin")).toEqual({ done: 1, total: 6 });
    p = toggleStep(p, "2026-11-24", "matin", "m-up", at);
    expect(p.sleep["2026-11-24"].wake).toBeUndefined();
    expect(progressOf(p, "2026-11-24", "matin").done).toBe(0);
  });

  it("le matin, on note l'extinction de la veille (après minuit = le lendemain) et la lecture", () => {
    let p = reportBed(plan(), "2026-11-23", "00:30");
    expect(new Date(p.sleep["2026-11-23"].bed!).getTime()).toBe(new Date(2026, 10, 24, 0, 30).getTime());
    expect(isDone(p, "2026-11-23", "soir", "s-bed")).toBe(true);
    p = reportBed(p, "2026-11-23", "23:15");
    expect(new Date(p.sleep["2026-11-23"].bed!).getTime()).toBe(new Date(2026, 10, 23, 23, 15).getTime());

    const lec = lectureOcc(p, "2026-11-23")!;
    expect(lec.title).toMatch(/^Lecture au lit/);
    p = reportLecture(p, "2026-11-23", true);
    expect(p.done[lec.key]).toBeTruthy();
    expect(isDone(p, "2026-11-23", "soir", "s-read")).toBe(true);
    p = reportLecture(p, "2026-11-23", false);
    expect(p.done[lec.key]).toBeUndefined();
    expect(nightPending(p, "2026-11-23")).toEqual({ bed: false, lecture: false }); // « non » est une réponse
    expect(nightPending(plan(), "2026-11-23")).toEqual({ bed: true, lecture: true });
    expect(nightPending(plan(), "2026-11-27")).toEqual({ bed: false, lecture: false }); // vendredi soir : rien à noter
  });

  it("l'heure « à l'heure » du bilan sommeil suit le lever prévu de chaque jour", () => {
    let p = plan();
    p = toggleStep(p, "2026-11-23", "matin", "m-up", new Date(2026, 10, 23, 8, 5)); // lundi, prévu 8 h
    p = toggleStep(p, "2026-11-24", "matin", "m-up", new Date(2026, 10, 24, 8, 5)); // mardi, prévu 7 h 15
    p = reportBed(p, "2026-11-23", "23:20");
    const s = sleepStats(p, "2026-11-23", "2026-11-24");
    expect(s.onTimeWake).toBe(1);
    expect(s.onTimeBed).toBe(1);
    expect(s.nights).toBe(1);
  });
});

describe("migrations et corrections", () => {
  it("renomme la lecture du soir et marque les synthèses comme non notées, sans toucher à ce que tu as modifié", () => {
    const p = seedPlan();
    const old: Plan = {
      ...p,
      activities: p.activities.map((a) =>
        a.cat === "lecture" ? { ...a, title: "Téléphone posé sur le lit · lecture · extinction 23 h 15" }
          : a.id === "ev-synth-1" ? { ...a, title: "Synthèse EDHEC · devoir 1 à rendre (Drive)" }
            : a.id === "ev-synth-2" ? { ...a, title: "Mon titre", edited: true } : a),
      routines: undefined as unknown as Plan["routines"],
      routineLog: undefined as unknown as Plan["routineLog"],
    };
    const n = normalize(old);
    expect(n.activities.find((a) => a.cat === "lecture")!.title).toBe("Lecture au lit (livre papier) · extinction 23 h 15");
    const s1 = n.activities.find((a) => a.id === "ev-synth-1")!;
    expect(s1.title).toBe("Synthèse EDHEC · devoir 1 à rendre · non noté, corrigé");
    expect(s1.notes).toMatch(/PGE-PGO/);
    expect(n.activities.find((a) => a.id === "ev-synth-2")!.title).toBe("Mon titre");
    expect(n.routines.matin.length).toBeGreaterThan(0);
    expect(n.routineLog).toEqual({});
    expect(normalize(n)).toEqual(n); // idempotent
  });

  it("un élément de l'agenda supprimé ne revient pas à l'import suivant", () => {
    const ds: Activity = { id: "gcal-x", title: "DS de maths", cat: "eval", prio: "fixe", date: "2026-12-04", start: "13:00", end: "17:00", check: false, deadline: true, source: "gcal" };
    let p = upsertExternal(plan(), [ds]);
    expect(expand(p, "2026-12-04", "2026-12-04").some((o) => o.title === "DS de maths")).toBe(true);
    p = deleteOccurrence(p, keyOf("gcal-x", "1"), "one");
    p = upsertExternal(p, [ds]);
    expect(expand(p, "2026-12-04", "2026-12-04").some((o) => o.title === "DS de maths")).toBe(false);
  });

  it("la conférence de M. Rossi est un simple événement ; le DS du 9/12 est une épreuve", () => {
    const p = plan();
    const conf = p.activities.find((a) => a.id === "gcal-d02pc7bm3j1jgilen04p5bom4c")!;
    expect(conf.cat).toBe("cours");
    expect(conf.deadline).toBeFalsy();
    expect(conf.title).not.toMatch(/DS/);
    const ds = p.activities.find((a) => a.id === "gcal-gj3tf6b84jsb9ho2s7l2t4fep8")!;
    expect(ds.cat).toBe("eval");
    expect(ds.deadline).toBe(true);
  });

  it("une copie de synthèse n'a pas de note", () => {
    expect(isUngraded({ cat: "synthese", kind: "Synthèse" })).toBe(true);
    expect(isUngraded({ cat: "micro", kind: "DS" })).toBe(false);
  });
});

describe("horaires de sommeil réglables", async () => {
  const { applySchedule, currentSchedule, nightLength, reportWake } = await import("./routine");
  it("lit les horaires actuels du planning, puis les applique sans toucher au passé", () => {
    let p = plan();
    const cur = currentSchedule(p, "2026-11-22");
    expect(cur.map((d) => d.wake)).toEqual(["08:00", "07:15", "07:15", "08:00", "07:15", "10:00", "10:00"]);
    expect(cur[4].bed).toBeUndefined(); // vendredi soir libre
    expect(cur[6].bed).toBe("23:15"); // dimanche soir
    expect(nightLength(cur, 0)).toBe(8 * 60 + 45); // dimanche 23 h 15 → lundi 8 h

    // lecture validée lundi 23/11 avant le changement : doit rester
    const lec = lectureOcc(p, "2026-11-23")!;
    p = reportLecture(p, "2026-11-23", true);
    const sched = cur.map((_, i) => ({ wake: i < 5 ? "07:30" : "09:30", bed: i === 4 || i === 5 ? undefined : "23:00" }));
    p = applySchedule(p, sched, "2026-11-25");
    expect(p.done[lec.key]).toBeTruthy();
    expect(lectureOcc(p, "2026-11-23")!.end).toBe("23:15"); // passé intact
    expect(wakeAt(p, "2026-11-24")).toBe("07:15"); // mardi 24 : avant le changement
    expect(wakeAt(p, "2026-11-26")).toBe("07:30");
    expect(wakeAt(p, "2026-11-28")).toBe("09:30");
    expect(lightsOut(p, "2026-11-25")).toBe("23:00");
    expect(eveningExpected(p, "2026-11-27")).toBe(false); // vendredi libre
    expect(eveningExpected(p, "2026-11-25")).toBe(true); // mercredi soir : lecture créée
    expect(lectureOcc(p, "2026-11-25")!.start).toBe("22:30");
    // une seule routine du matin par jour, même en appliquant deux fois
    p = applySchedule(p, sched, "2026-11-25");
    expect(expand(p, "2026-11-26", "2026-11-26").filter((o) => /^Routine du matin/.test(o.title))).toHaveLength(1);
  });

  it("on peut noter l'heure réelle du lever après coup", () => {
    const p = reportWake(plan(), "2026-11-22", "12:00");
    expect(new Date(p.sleep["2026-11-22"].wake!).getTime()).toBe(new Date(2026, 10, 22, 12, 0).getTime());
    expect(isDone(p, "2026-11-22", "matin", "m-up")).toBe(true);
  });
});
