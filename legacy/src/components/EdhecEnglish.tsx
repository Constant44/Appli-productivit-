/** Anglais EDHEC : QCM blanc en conditions réelles et thème-version de Mme Terroni. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { askJson, AiError, useAi } from "../lib/ai";
import { isoDay, uid } from "../lib/utils";
import BANK from "../data/edhec-qcm.json";
import TV from "../data/terroni-tv.json";

type BankQ = { theme: string; q: string; choices: string[]; answer: number; explain: string };
const QS = BANK as BankQ[];
const SENTENCES = TV as Array<{ id: string; dir: "theme" | "version"; sec: string; src: string; dst: string }>;

/** Thème sans la mention de la source : « Les temps (Wooclap) » et « Les temps » se regroupent. */
const themeOf = (t: string) => t.replace(/\s*\(.*\)\s*$/, "").trim();

/** Tire n questions en équilibrant les thèmes (round-robin sur des thèmes mélangés). */
function draw(n: number): BankQ[] {
  const by = new Map<string, BankQ[]>();
  for (const q of [...QS].sort(() => Math.random() - 0.5)) by.set(themeOf(q.theme), [...(by.get(themeOf(q.theme)) ?? []), q]);
  const lists = [...by.values()].sort(() => Math.random() - 0.5);
  const out: BankQ[] = [];
  for (let i = 0; out.length < n && lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i]);
  return out.sort(() => Math.random() - 0.5);
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * QCM blanc : 50 questions, 50 minutes, sans correction pendant l'épreuve (comme le jour J),
 * pas de points négatifs. Note /20, bilan par thème, erreurs envoyées au carnet de révision.
 */
export function QcmBlanc() {
  const updateEdhec = useStore((s) => s.updateEdhec);
  const addCards = useStore((s) => s.addCards);
  const english = useStore((s) => s.edhec.english);
  const history = useMemo(() => english.filter((r) => r.mode === "blanc"), [english]);
  const [qs, setQs] = useState<BankQ[] | null>(null);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [i, setI] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);
  const LIMIT = 50 * 60;
  const finishing = useRef(false);

  useEffect(() => {
    if (!qs || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qs, done]);

  const left = qs && !done ? LIMIT - Math.floor((now - startedAt) / 1000) : LIMIT;

  const start = () => {
    const d = draw(50);
    setQs(d); setPicks(d.map(() => null)); setI(0); setDone(false); setStartedAt(Date.now()); setNow(Date.now());
    finishing.current = false;
  };

  const finish = () => {
    if (!qs || finishing.current) return;
    finishing.current = true;
    const byTheme: Record<string, [number, number]> = {};
    let score = 0;
    const wrong: BankQ[] = [];
    qs.forEach((q, k) => {
      const th = themeOf(q.theme);
      byTheme[th] = byTheme[th] ?? [0, 0];
      byTheme[th][1]++;
      if (picks[k] === q.answer) { score++; byTheme[th][0]++; } else wrong.push(q);
    });
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    updateEdhec((e) => ({ ...e, english: [...e.english, { date: isoDay(new Date()), score, total: qs.length, mode: "blanc", minutes, byTheme }] }));
    if (wrong.length)
      addCards(wrong.map((q) => ({
        id: `en-${uid()}`, deck: "anglais" as const,
        front: `Complète : ${q.q}\n(${q.choices.join(" / ")})`,
        back: `${q.choices[q.answer]}\n${q.explain}`,
      })));
    setDone(true);
  };

  useEffect(() => { if (qs && !done && left <= 0) finish(); });

  if (!qs)
    return (
      <div className="stack" style={{ alignItems: "flex-start" }}>
        <p className="small muted" style={{ margin: 0 }}>
          50 questions tirées de ta banque ({QS.length} questions : Drive, Wooclap de Mme Terroni), tous les thèmes mélangés.
          50 minutes, aucune correction avant la fin, pas de points négatifs : comme le jour J.
        </p>
        <button className="btn primary big" onClick={start}>⏱️ Lancer le QCM blanc</button>
        {history.length > 0 && <BlancHistory />}
      </div>
    );

  if (done) {
    const last = history[history.length - 1];
    const score = last?.score ?? 0;
    const note = Math.round((score / qs.length) * 200) / 10;
    const themes = Object.entries(last?.byTheme ?? {}).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
    return (
      <div className="stack">
        <div className="blanc-score">
          <div><b>{note.toFixed(1)}</b><span>/20</span></div>
          <div className="small muted">{score}/{qs.length} bonnes réponses · {last?.minutes ?? "?"} min</div>
        </div>
        <div className="small muted">Tes thèmes les plus fragiles :</div>
        <div className="theme-bars">
          {themes.slice(0, 6).map(([t, [ok, n]]) => (
            <div key={t} className="theme-bar">
              <span>{t}</span>
              <div className="bar"><div style={{ width: `${(ok / n) * 100}%`, background: ok / n >= 0.75 ? "var(--accent)" : ok / n >= 0.5 ? "#f5b301" : "var(--red)" }} /></div>
              <b>{ok}/{n}</b>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Tes {qs.length - score} erreurs sont devenues des cartes « Anglais » : elles reviendront dans tes révisions.</p>
        <details className="blanc-review">
          <summary className="small"><b>Revoir les erreurs</b></summary>
          <div className="stack" style={{ gap: 10, marginTop: 8 }}>
            {qs.map((q, k) => picks[k] === q.answer ? null : (
              <div key={k} className="small">
                <div>{q.q}</div>
                <div>❌ {picks[k] === null ? "(pas de réponse)" : q.choices[picks[k]!]} · ✅ <b>{q.choices[q.answer]}</b></div>
                <div className="muted">{q.explain}</div>
              </div>
            ))}
          </div>
        </details>
        <button className="btn" onClick={() => setQs(null)}>Terminer</button>
      </div>
    );
  }

  const q = qs[i];
  const answered = picks.filter((p) => p !== null).length;
  return (
    <div className="stack">
      <div className="row between small">
        <span>Question {i + 1}/{qs.length} · {answered} répondues</span>
        <span className={`pill ${left < 300 ? "red" : ""}`} style={{ fontVariantNumeric: "tabular-nums" }}>⏱️ {fmtClock(left)}</span>
      </div>
      <div className="flash-front" style={{ fontSize: 18 }}>{q.q}</div>
      <div className="grid g2" style={{ gap: 8 }}>
        {q.choices.map((c, k) => (
          <button key={k} className={`btn choice ${picks[i] === k ? "picked" : ""}`} onClick={() => setPicks(picks.map((p, j) => (j === i ? k : p)))}>
            {String.fromCharCode(65 + k)}. {c}
          </button>
        ))}
      </div>
      <div className="qcm-dots" aria-label="Navigation dans les questions">
        {qs.map((_, k) => (
          <button key={k} className={`${k === i ? "cur" : ""} ${picks[k] !== null ? "ok" : ""}`} onClick={() => setI(k)} aria-label={`Question ${k + 1}`} />
        ))}
      </div>
      <div className="row between">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>← Précédente</button>
        {i + 1 < qs.length
          ? <button className="btn primary" onClick={() => setI(i + 1)}>Suivante →</button>
          : <button className="btn primary" onClick={finish}>Rendre la copie</button>}
      </div>
      {i + 1 < qs.length && answered === qs.length && <button className="btn gold" onClick={finish}>Tout est répondu : rendre la copie</button>}
    </div>
  );
}

function BlancHistory() {
  const english = useStore((s) => s.edhec.english);
  const list = useMemo(() => english.filter((r) => r.mode === "blanc").slice(-8), [english]);
  const W = 260, H = 70;
  const pts = list.map((r, k) => [list.length === 1 ? W / 2 : (k / (list.length - 1)) * (W - 20) + 10, H - 8 - (r.score / r.total) * (H - 16)] as const);
  return (
    <div className="stack" style={{ gap: 4, width: "100%" }}>
      <span className="small muted">Tes QCM blancs (note /20)</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="blanc-chart" role="img" aria-label="Évolution des notes de QCM blanc">
        <line x1="0" x2={W} y1={H - 8 - 0.5 * (H - 16)} y2={H - 8 - 0.5 * (H - 16)} className="grid10" />
        {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} className="line" />}
        {pts.map((p, k) => (
          <g key={k}>
            <circle cx={p[0]} cy={p[1]} r="3.5" className="dot" />
            <text x={p[0]} y={p[1] - 7} textAnchor="middle" className="lbl">{((list[k].score / list[k].total) * 20).toFixed(1)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

type TvGrade = { score: number; remarques: string };

/**
 * Thème-version de Mme Terroni : les phrases jamais faites ou ratées d'abord ;
 * on traduit, on compare au corrigé de la prof, Claude note /2 (sinon auto-évaluation).
 */
export function TvTrainer() {
  const tvRaw = useStore((s) => s.edhec.tv);
  const tv = useMemo(() => tvRaw ?? {}, [tvRaw]);
  const updateEdhec = useStore((s) => s.updateEdhec);
  const ai = useAi((s) => s.available);
  const [dir, setDir] = useState<"theme" | "version" | "all">("all");
  const [cur, setCur] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);
  const [grade, setGrade] = useState<TvGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const queue = useMemo(() => {
    const pool = SENTENCES.filter((s) => dir === "all" || s.dir === dir);
    const rank = (id: string) => (tv[id] ? tv[id].score * 10 + Math.min(9, tv[id].n) : -1);
    return [...pool].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [dir, tv]);
  const s = SENTENCES.find((x) => x.id === cur) ?? null;
  const mastered = SENTENCES.filter((x) => (tv[x.id]?.score ?? 0) >= 2).length;

  const next = () => {
    const pick = queue.find((x) => x.id !== cur) ?? queue[0];
    setCur(pick?.id ?? null); setAnswer(""); setShown(false); setGrade(null); setError("");
  };

  const save = (score: number) => {
    if (!s) return;
    updateEdhec((e) => ({ ...e, tv: { ...(e.tv ?? {}), [s.id]: { score, date: isoDay(new Date()), n: (e.tv?.[s.id]?.n ?? 0) + 1 } } }));
    next();
  };

  const correct = async () => {
    if (!s) return;
    setBusy(true); setError("");
    try {
      const r = await askJson<TvGrade>(
        `Tu es correcteur de l'épreuve de LV1 anglais du concours EDHEC. Note sur 2 (0, 0.5, 1, 1.5 ou 2) la traduction de l'élève (${s.dir === "theme" ? "thème, français → anglais" : "version, anglais → français"}), avec exigence sur la grammaire, le lexique et l'idiomaticité. Accepte toute traduction juste, même différente du corrigé.
Texte : ${s.src}
Corrigé de la professeure : ${s.dst}
Traduction de l'élève : ${answer || "(vide)"}
Réponds en JSON : {"score": nombre, "remarques": "en français, 2 à 4 phrases : erreurs précises, règle à retenir"}`,
        { fresh: true },
      );
      setGrade(r);
    } catch (e) {
      setError((e as AiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="seg-mini">
          {(["all", "theme", "version"] as const).map((d) => (
            <button key={d} className={dir === d ? "on" : ""} onClick={() => { setDir(d); setCur(null); }}>{d === "all" ? "Tout" : d === "theme" ? "Thème" : "Version"}</button>
          ))}
        </div>
        <span className="small muted">{mastered}/{SENTENCES.length} phrases réussies à 2/2</span>
      </div>
      {!s ? (
        <button className="btn primary big" onClick={next}>✍️ Commencer ({queue.length} phrases)</button>
      ) : (
        <>
          <div className="small muted">{s.dir === "theme" ? "Thème · français → anglais" : "Version · anglais → français"} · {s.sec}{tv[s.id] ? ` · dernière note ${tv[s.id].score}/2` : " · jamais faite"}</div>
          <div className="flash-front" style={{ fontSize: 17, textAlign: "left" }}>{s.src}</div>
          <textarea id="tv-answer" className="input" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ta traduction" disabled={shown} />
          {!shown ? (
            <div className="row">
              <button className="btn primary" onClick={() => setShown(true)}>Voir le corrigé</button>
              <button className="btn ghost" onClick={next}>Passer</button>
            </div>
          ) : (
            <>
              <div className="sheet-body small"><b>Corrigé de Mme Terroni :</b> {s.dst}</div>
              {grade && <div className="sheet-body small"><b>{grade.score}/2</b> · {grade.remarques}</div>}
              {error && <div className="small" style={{ color: "var(--red)" }}>{error}</div>}
              <div className="row" style={{ flexWrap: "wrap" }}>
                {ai !== false && !grade && answer.trim() && <button className="btn" disabled={busy} onClick={correct}>{busy ? "Claude corrige…" : "✨ Faire noter par Claude"}</button>}
                {grade
                  ? <button className="btn primary" onClick={() => save(grade.score)}>Enregistrer {grade.score}/2 →</button>
                  : (
                    <>
                      <span className="small muted">Ta note :</span>
                      {[0, 1, 2].map((n) => <button key={n} className="btn sm" onClick={() => save(n)}>{n}/2</button>)}
                    </>
                  )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
