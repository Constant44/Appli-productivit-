/** État de la liaison Google Agenda + boutons pour la réparer (sur chaque navigateur, l'accès s'autorise à part). */
import { useEffect, useState } from "react";
import { connectCal, manageCal, refreshCal, testCal, useCal } from "../lib/calendar";

const LABEL = {
  ok: "✓ Relié : notification silencieuse à la fin de chaque séance, bloc 🍅 quand tu valides.",
  prompt: "Pas encore autorisé sur ce navigateur.",
  denied: "Refusé sur ce navigateur : Cadence ne peut ni te notifier ni ajouter tes blocs.",
  missing: "Google Calendar n'est pas connecté à ton compte claude.ai sur ce navigateur.",
  unknown: "État inconnu : appuie sur « Tester » pour vérifier.",
} as const;

export function CalLink({ full }: { full?: boolean }) {
  const { state, queued, code } = useCal();
  const [busy, setBusy] = useState(false);
  useEffect(() => void refreshCal(), []);
  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  if (!full && state !== "denied" && state !== "missing" && state !== "prompt" && !queued) return null;
  return (
    <div className={`cal-link ${state}`}>
      <p className="small">
        {full ? LABEL[state] : "⚠️ Google Agenda non relié ici : pas de notification à la fin."}
        {queued > 0 && ` ${queued} bloc${queued > 1 ? "s" : ""} 🍅 en attente.`}
        {full && code && state !== "ok" && <span className="muted"> ({code})</span>}
      </p>
      <div className="row gap wrap">
        {state !== "ok" || queued ? <button className="btn sm primary" disabled={busy} onClick={run(connectCal)}>Relier Google Agenda</button> : null}
        {full && <button className="btn sm ghost" disabled={busy} onClick={run(testCal)}>Tester (notif dans 1 min)</button>}
        {full && <button className="btn sm ghost" disabled={busy} onClick={run(manageCal)}>Ouvrir les autorisations</button>}
      </div>
      {full && state === "missing" && (
        <p className="muted small">Sur Safari : claude.ai → Réglages → Connecteurs → Google Calendar → Connecter, puis recharge Cadence.</p>
      )}
    </div>
  );
}
