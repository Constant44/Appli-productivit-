import { useRef, useState } from "react";
import { exportData, useStore } from "../lib/store";
import { syncPronote } from "../lib/pronote";
import { demoData } from "../lib/demo";
import { fmtDay, fmtTime } from "../lib/utils";
import { Field, Seg } from "../components/ui";

export default function Settings() {
  const { pronote, settings, updateSettings, toast, importData, resetAll, loadDemo } = useStore();
  const [method, setMethod] = useState<"password" | "qr">("password");
  const [url, setUrl] = useState(pronote.url);
  const [username, setUsername] = useState(pronote.username);
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [newSubject, setNewSubject] = useState("");

  const run = async (creds: Parameters<typeof syncPronote>[0]) => {
    setBusy(true);
    setError("");
    try {
      const r = await syncPronote(creds);
      setPassword("");
      toast({ title: "🔄 Pronote synchronisé", body: `${r.tasks} nouveaux devoirs · ${r.evals} DS/khôlles détectés · ${r.grades} notes`, tone: "good" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Pronote & réglages</h1>
      <p className="page-sub">Tout est stocké localement dans ton navigateur. Ton mot de passe Pronote n'est jamais enregistré : seul un jeton de reconnexion l'est.</p>
      <div className="grid g2">
        <div className="card">
          <h3>🔗 Connexion Pronote</h3>
          {pronote.token && (
            <div className="stack" style={{ marginBottom: 14 }}>
              <div className="row between">
                <div>
                  <b>{pronote.user?.name ?? pronote.username}</b>
                  <div className="small muted">{pronote.user?.className} · {pronote.user?.establishment}</div>
                  {pronote.lastSync && <div className="small muted">Dernière synchro : {fmtDay(pronote.lastSync)} à {fmtTime(pronote.lastSync)}</div>}
                </div>
                <button className="btn primary" disabled={busy} onClick={() => run({})}>{busy ? "⏳…" : "🔄 Synchroniser"}</button>
              </div>
              {pronote.warnings && pronote.warnings.length > 0 && (
                <div className="small" style={{ color: "var(--gold)" }}>Avertissements : {pronote.warnings.join(" · ")}</div>
              )}
              <hr className="sep" />
              <div className="small muted">Reconnexion manuelle (si le jeton a expiré) :</div>
            </div>
          )}
          <Seg value={method} onChange={setMethod} options={[["password", "Identifiants"], ["qr", "QR code (ENT)"]]} />
          <div className="stack" style={{ marginTop: 12 }}>
            {method === "password" ? (
              <>
                <Field label="URL Pronote (celle de la page élève)">
                  <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://0000000x.index-education.net/pronote/eleve.html" />
                </Field>
                <div className="form-grid">
                  <Field label="Identifiant"><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></Field>
                  <Field label="Mot de passe"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
                </div>
                <button className="btn primary" disabled={busy || !url || !username || !password} onClick={() => run({ url, username, password })}>
                  {busy ? "Connexion…" : "Se connecter et synchroniser"}
                </button>
                <p className="small muted" style={{ margin: 0 }}>
                  Si ton lycée passe par un ENT (connexion via un autre site), la connexion par identifiants ne marche pas : utilise l'onglet QR code.
                </p>
              </>
            ) : (
              <>
                <ol className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Sur Pronote (ordinateur), clique sur l'icône QR code « Accéder à l'appli mobile ».</li>
                  <li>Choisis un code PIN à 4 chiffres et génère le QR code.</li>
                  <li>Scanne-le avec l'appareil photo de ton téléphone : un texte JSON s'affiche (commençant par <code>{"{"}"jeton"…</code>). Copie-le ci-dessous.</li>
                </ol>
                <Field label="Contenu du QR code (JSON)"><textarea className="input" rows={3} value={qr} onChange={(e) => setQr(e.target.value)} placeholder='{"jeton":"…","login":"…","url":"…"}' /></Field>
                <Field label="Code PIN"><input className="input" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} /></Field>
                <button className="btn primary" disabled={busy || !qr || pin.length !== 4} onClick={() => {
                  try { run({ qr: JSON.parse(qr), pin }); } catch { setError("Le contenu du QR code n'est pas un JSON valide."); }
                }}>
                  {busy ? "Connexion…" : "Se connecter avec le QR code"}
                </button>
              </>
            )}
            {error && <div className="pill red" style={{ whiteSpace: "normal" }}>❌ {error}</div>}
            <div className="small muted">
              Ce qui est importé : emploi du temps (−7 j à +5 semaines), devoirs → to-do, cours marqués « devoir surveillé » → DS, cours contenant « khôlle/colle » → khôlles, toutes les notes.
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>⏱️ Travail</h3>
            <div className="form-grid">
              <Field label="Pomodoro (min)"><input className="input" type="number" value={settings.pomodoroWork} onChange={(e) => updateSettings({ pomodoroWork: Math.max(1, Number(e.target.value)) })} /></Field>
              <Field label="Pause (min)"><input className="input" type="number" value={settings.pomodoroBreak} onChange={(e) => updateSettings({ pomodoroBreak: Math.max(1, Number(e.target.value)) })} /></Field>
              <Field label="Objectif / jour (min)"><input className="input" type="number" value={settings.dailyGoalMin} onChange={(e) => updateSettings({ dailyGoalMin: Math.max(10, Number(e.target.value)) })} /></Field>
            </div>
            <label className="row small" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} /> Son en fin de session
            </label>
          </div>
          <div className="card">
            <h3>📚 Matières</h3>
            <div className="row" style={{ gap: 6 }}>
              {settings.subjects.map((s) => (
                <span key={s} className="pill">{s} <button className="btn sm ghost" style={{ padding: 0 }} onClick={() => updateSettings({ subjects: settings.subjects.filter((x) => x !== s) })}>✕</button></span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="input" style={{ flex: 1 }} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Ajouter une matière" onKeyDown={(e) => {
                if (e.key === "Enter" && newSubject.trim()) { updateSettings({ subjects: [...settings.subjects, newSubject.trim()] }); setNewSubject(""); }
              }} />
            </div>
          </div>
          <div className="card">
            <h3>💾 Données</h3>
            <div className="row">
              <button className="btn" onClick={() => {
                const blob = new Blob([exportData()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `prepa-fc-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
              }}>⬇️ Exporter (sauvegarde)</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>⬆️ Importer</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { importData(await f.text()); toast({ title: "Sauvegarde restaurée", tone: "good" }); }
                catch (err) { toast({ title: "Import impossible", body: (err as Error).message, tone: "warn" }); }
              }} />
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => confirm("Remplacer toutes tes données par des données de démo ?") && loadDemo(demoData())}>🧪 Charger la démo</button>
              <button className="btn danger" onClick={() => confirm("Tout effacer (tâches, sessions, club…) ? Irréversible.") && resetAll()}>🗑️ Tout réinitialiser</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
