/** Accueils de rubrique : la pièce du club en grand + les destinations avec leur état du moment. */
import { useMemo } from "react";
import { useActiveCards, useStore } from "../lib/store";
import { buildQueue, nextTestDay } from "../lib/srs";
import { DEFAULT_SUBJECT_COEFS, subjectAverages } from "../lib/insights";
import { daysUntil, fmtRelDay, fmtTime, isoDay } from "../lib/utils";
import { Room, type RoomSpot } from "../components/Rooms";
import { EDHEC_DATE, currentPhase } from "./Edhec";
import { navigate, type View } from "../App";

type Dest = { view: View; key: string; icon: string; label: string; status: string; hot?: boolean };

function HubCards({ dests }: { dests: Dest[] }) {
  return (
    <div className="hub-cards">
      {dests.map((d) => (
        <button key={d.view} className={`hub-card ${d.hot ? "hot" : ""}`} onClick={() => navigate(d.view)}>
          <span className="hub-ico">{d.icon}</span>
          <span className="hub-txt"><b>{d.label}</b><span>{d.status}</span></span>
          <span className="hub-go">→</span>
        </button>
      ))}
    </div>
  );
}

const spotsOf = (dests: Dest[]): RoomSpot[] => dests.map((d) => ({ key: d.key, label: d.label, icon: d.icon, onClick: () => navigate(d.view) }));

export function StudyHub() {
  const warmups = useStore((s) => s.warmups);
  const reviews = useStore((s) => s.reviews);
  const plans = useStore((s) => s.plans);
  const cards = useActiveCards();
  const toReview = useMemo(() => buildQueue(cards, reviews, { newLimit: 20, max: 999, decks: ["actu", "bio", "mot", "erreur"] }).length, [cards, reviews]);
  const dTest = daysUntil(nextTestDay());
  const dEdhec = daysUntil(EDHEC_DATE);
  const warm = warmups.includes(isoDay(new Date()));
  const dests: Dest[] = [
    { view: "warmup", key: "cards", icon: "🔥", label: "Échauffement", status: warm ? "Fait aujourd'hui ✓" : "15 min · à faire", hot: !warm },
    { view: "vendredi", key: "paper", icon: "🗞️", label: "Test du vendredi", status: `${dTest === 0 ? "Aujourd'hui" : dTest === 1 ? "Demain" : `J-${dTest}`} · ${toReview} cartes à voir`, hot: dTest <= 1 },
    { view: "edhec", key: "poster", icon: "🎯", label: "EDHEC", status: `J-${dEdhec} · ${currentPhase().name.split(" (")[0]}` },
    { view: "plan", key: "clock", icon: "🗓️", label: "Planning", status: plans.length ? `${plans.length} période${plans.length > 1 ? "s" : ""} de révision` : "Planifier une période de révision" },
  ];
  return (
    <div className="hub">
      <Room id="library" spots={spotsOf(dests)} info={{ edhec: `J-${dEdhec}` }} className="hub-room" />
      <HubCards dests={dests} />
    </div>
  );
}

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

export function AgendaHub() {
  const tasks = useStore((s) => s.tasks);
  const evals = useStore((s) => s.evals);
  const lessons = useStore((s) => s.lessons);
  const grades = useStore((s) => s.grades);
  const coefs = useStore((s) => s.settings.subjectCoefs);
  const open = tasks.filter((t) => !t.done);
  const late = open.filter((t) => t.due && daysUntil(t.due) < 0).length;
  const next = evals.filter((e) => +new Date(e.date) >= Date.now()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const now = Date.now();
  const nextLesson = lessons.filter((l) => !l.canceled && +new Date(l.end) > now).sort((a, b) => a.start.localeCompare(b.start))[0];
  const avg = useMemo(() => subjectAverages(grades, coefs ?? DEFAULT_SUBJECT_COEFS).overall, [grades, coefs]);
  const dests: Dest[] = [
    { view: "tasks", key: "board", icon: "📌", label: "To-do", status: open.length ? `${open.length} à faire${late ? ` · ${late} en retard` : ""}` : "Rien en attente", hot: late > 0 },
    { view: "evals", key: "copies", icon: "📝", label: "DS & khôlles", status: next ? `${next.type} ${next.subject} ${fmtRelDay(next.date)}` : "Rien de prévu", hot: !!next && daysUntil(next.date) <= 1 },
    { view: "tt", key: "calendar", icon: "📅", label: "Emploi du temps", status: nextLesson ? `${nextLesson.subject} ${fmtRelDay(nextLesson.start)} ${fmtTime(nextLesson.start)}` : "Aucun cours à venir" },
    { view: "grades", key: "whiteboard", icon: "📊", label: "Notes", status: Number.isNaN(avg) ? "Pas encore de notes" : `Moyenne générale ${avg.toFixed(2)}` },
  ];
  return (
    <div className="hub">
      <Room id="office" spots={spotsOf(dests)} info={{ month: MONTHS[new Date().getMonth()], avg: Number.isNaN(avg) ? "" : `Moy. ${avg.toFixed(2)}` }} className="hub-room" />
      <HubCards dests={dests} />
    </div>
  );
}
