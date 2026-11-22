/** Plus : tous les outils, rangés par usage. */
import { navigate, type View } from "../App";

const GROUPS: Array<[string, Array<[View, string, string, string]>]> = [
  ["S'entraîner", [
    ["warmup", "🔥", "Échauffement", "Cartes du jour, 15 min"],
    ["vendredi", "🗞️", "Test du vendredi", "Actu, mots, personnages"],
    ["edhec", "🎯", "EDHEC", "QCM blanc, thème-version, micro, synthèse"],
    ["focus", "⏱️", "Chrono libre", "Une session sans programme"],
  ]],
  ["Suivre", [
    ["stats", "📈", "Stats", "Bilan de la semaine, temps par matière"],
    ["grades", "📊", "Notes", "Moyennes et objectif"],
    ["plan", "🗓️", "Périodes de révision", "Planifier un blocus"],
  ]],
  ["Le club", [
    ["club", "🏟️", "Prépa City", "Ton club, tes joueurs, ta ville"],
    ["study", "🪑", "Bureau d'étude", "L'ancienne vue en pièces"],
    ["agenda", "🗂️", "Bureau du coach", "L'ancienne vue agenda"],
  ]],
  ["Réglages", [["settings", "⚙️", "Réglages", "Sauvegarde, objectif quotidien, Pronote"]]],
];

export default function More() {
  return (
    <div className="more">
      <h1 className="page-title">Plus</h1>
      {GROUPS.map(([title, items]) => (
        <section key={title} style={{ marginBottom: 18 }}>
          <h3 className="more-h">{title}</h3>
          <div className="more-grid">
            {items.map(([v, ico, label, sub]) => (
              <button key={v} className="more-tile" onClick={() => navigate(v)}>
                <span>{ico}</span><b>{label}</b><small>{sub}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
