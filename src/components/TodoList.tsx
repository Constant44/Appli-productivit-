/** To-do list sans horaire : ce que j'ai à faire aujourd'hui, ou à ne pas oublier demain. */
import { useState } from "react";
import { addDays, fmtShort, type ISODate } from "../lib/dates";
import { uid, type Todo } from "../lib/model";
import { useStore } from "../lib/store";

export default function TodoList({ date, today }: { date: ISODate; today: ISODate }) {
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"day" | "next">("day");
  const all = plan.todos ?? [];
  // ce jour-là, plus (aujourd'hui) ce qui n'a pas été coché les jours d'avant
  const items = all
    .filter((x) => x.date === date || (date === today && x.date < today && !x.doneAt))
    .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.date.localeCompare(b.date));
  const set = (f: (l: Todo[]) => Todo[], msg?: string) => apply((p) => ({ ...p, todos: f(p.todos ?? []) }), msg);
  const add = () => {
    const t = text.trim();
    if (!t) return;
    const d = when === "day" ? date : addDays(date, 1);
    set((l) => [...l, { id: uid(), text: t, date: d }], when === "next" ? "Ajouté pour demain" : undefined);
    setText("");
  };
  const left = items.filter((x) => !x.doneAt).length;
  return (
    <section className="todo">
      <div className="todo-head">
        <h3 className="h3">À faire <span className="count">{left}</span></h3>
      </div>
      {items.length > 0 && (
        <ul className="todo-list">
          {items.map((x) => (
            <li key={x.id} className={x.doneAt ? "done" : ""}>
              <button className={`check ${x.doneAt ? "on" : ""}`} aria-label={x.doneAt ? "Décocher" : "Fait"}
                onClick={() => set((l) => l.map((y) => (y.id === x.id ? { ...y, doneAt: y.doneAt ? undefined : new Date().toISOString() } : y)))}>{x.doneAt ? "✓" : ""}</button>
              <span className="todo-text">{x.text}{x.date < date && <span className="muted small"> · depuis {fmtShort(x.date)}</span>}</span>
              <button className="todo-del" aria-label={`Supprimer ${x.text}`} onClick={() => set((l) => l.filter((y) => y.id !== x.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form className="todo-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input id="todo-in" className="input" placeholder="Ajouter un truc à faire…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="seg">
          <button type="button" className={when === "day" ? "on" : ""} onClick={() => setWhen("day")}>{date === today ? "Aujourd'hui" : "Ce jour"}</button>
          <button type="button" className={when === "next" ? "on" : ""} onClick={() => setWhen("next")}>Demain</button>
        </div>
        <button className="btn primary" disabled={!text.trim()}>Ajouter</button>
      </form>
    </section>
  );
}
