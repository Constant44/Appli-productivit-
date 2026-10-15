import { useState } from "react";
import { totalWorkMinutes, useStore } from "../lib/store";
import {
  DIVISIONS, FACILITIES, MATCH_COST_MIN, MAX_FACILITY, bestEleven, facilityCost, marketRange,
  playerValue, seasonPrize, sellPrice, standings, teamStrength,
} from "../lib/game";
import { POSITIONS, type FacilityKey, type Player, type Position } from "../lib/types";
import { fmtMin, fmtMoney } from "../lib/utils";
import { Bar, Field, Modal, Ovr, Seg } from "../components/ui";

type Tab = "home" | "squad" | "market" | "facilities" | "league";

const SPOTS: Record<Position, Array<[number, number]>> = {
  ATT: [[20, 17], [50, 13], [80, 17]],
  MIL: [[22, 43], [50, 47], [78, 43]],
  DEF: [[12, 70], [37, 73], [63, 73], [88, 70]],
  GB: [[50, 89]],
};

export default function ClubView() {
  const [tab, setTab] = useState<Tab>("home");
  const club = useStore((s) => s.club);
  return (
    <>
      <div className="row between">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Crest a={club.colorA} b={club.colorB} /> {club.name}
          </h1>
          <p className="page-sub">{DIVISIONS[club.season.division]} · Saison {club.season.number} · Journée {Math.min(club.season.currentRound + 1, club.season.rounds.length)}/{club.season.rounds.length}</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[["home", "🏟️ Match"], ["squad", "👥 Effectif"], ["market", "💸 Mercato"], ["facilities", "🏗️ Infrastructures"], ["league", "🏆 Championnat"]]} />
      </div>
      {tab === "home" && <MatchTab />}
      {tab === "squad" && <SquadTab />}
      {tab === "market" && <MarketTab />}
      {tab === "facilities" && <FacilitiesTab />}
      {tab === "league" && <LeagueTab />}
    </>
  );
}

const Crest = ({ a, b }: { a: string; b: string }) => (
  <svg width="34" height="38" viewBox="0 0 34 38" aria-hidden>
    <path d="M17 1 L33 6 V19 C33 29 25 35 17 37 C9 35 1 29 1 19 V6 Z" fill={b} stroke={a} strokeWidth="2.5" />
    <path d="M17 6 V33" stroke={a} strokeWidth="5" />
    <circle cx="17" cy="18" r="5" fill="#fff" />
  </svg>
);

function Pitch({ players, a, b }: { players: Player[]; a: string; b: string }) {
  const xi = bestEleven(players);
  return (
    <div className="pitch">
      <div className="lines" />
      <div className="box" style={{ top: "4%" }} />
      <div className="box" style={{ bottom: "4%" }} />
      {POSITIONS.flatMap((pos) =>
        SPOTS[pos].map(([x, y], i) => {
          const p = xi[pos][i];
          return (
            <div key={`${pos}${i}`} className="pl" style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="shirt" style={{ background: p ? b : "#0006", borderColor: p ? a : "#fff4", color: p ? "#fff" : "#fff8" }}>{p ? p.ovr : "?"}</div>
              <div className="nm">{p ? p.name.split(" ").slice(-1)[0] : `${pos} manquant`}</div>
            </div>
          );
        }),
      )}
    </div>
  );
}

function MatchTab() {
  const { club, playMatch, sessions } = useStore();
  const table = standings(club.season);
  const rank = table.findIndex((r) => r.isUser) + 1;
  const strength = teamStrength(club.players);
  const available = Math.floor(club.matchMinutesBank / MATCH_COST_MIN);
  const round = club.season.rounds[club.season.currentRound];
  const fx = round?.find((f) => f.home === "user" || f.away === "user");
  const oppId = fx ? (fx.home === "user" ? fx.away : fx.home) : null;
  const opp = club.season.teams.find((t) => t.id === oppId);
  const played = club.season.rounds.slice(0, club.season.currentRound).map((r) => r.find((f) => f.home === "user" || f.away === "user")!).filter(Boolean).reverse().slice(0, 6);
  const name = (id: string) => club.season.teams.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="grid g2">
      <div className="card"><Pitch players={club.players} a={club.colorA} b={club.colorB} /></div>
      <div className="stack">
        <div className="card">
          <div className="grid g3" style={{ gap: 10 }}>
            <div className="stat"><span className="v">{strength.toFixed(1)}</span><span className="l">Note du XI</span></div>
            <div className="stat"><span className="v">{rank}<sup>e</sup></span><span className="l">Classement</span></div>
            <div className="stat"><span className="v">{fmtMin(totalWorkMinutes(sessions))}</span><span className="l">Travail total</span></div>
          </div>
        </div>
        <div className="card" style={{ borderColor: available ? "var(--accent)" : undefined }}>
          <h3>⚽ Prochain match</h3>
          {opp ? (
            <>
              <div className="row between" style={{ fontSize: 18, fontWeight: 800 }}>
                <span>{fx!.home === "user" ? club.name : opp.name}</span>
                <span className="muted">vs</span>
                <span>{fx!.home === "user" ? opp.name : club.name}</span>
              </div>
              <div className="row between small muted" style={{ marginTop: 4 }}>
                <span>{fx!.home === "user" ? `🏠 Domicile · ${strength.toFixed(1)}` : `Note ${opp.strength}`}</span>
                <span>{fx!.home === "user" ? `Note ${opp.strength}` : `✈️ Extérieur · ${strength.toFixed(1)}`}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="row between small"><span>Débloqué par ton travail</span><b>{available > 0 ? `${available} match${available > 1 ? "s" : ""} dispo` : `${club.matchMinutesBank}/${MATCH_COST_MIN} min`}</b></div>
                <Bar value={Math.min(club.matchMinutesBank, MATCH_COST_MIN)} max={MATCH_COST_MIN} tone="blue" />
              </div>
              <button className="btn primary big" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} disabled={!available} onClick={playMatch}>
                {available ? "▶ Jouer le match" : `🔒 Encore ${MATCH_COST_MIN - club.matchMinutesBank} min de travail`}
              </button>
            </>
          ) : <div className="empty">Saison terminée.</div>}
        </div>
        <div className="card">
          <h3>Derniers résultats</h3>
          {played.length === 0 && <div className="empty">Aucun match joué.</div>}
          <div className="list">
            {played.map((f, i) => {
              const us = f.home === "user" ? f.hg! : f.ag!;
              const them = f.home === "user" ? f.ag! : f.hg!;
              return (
                <div key={i} className="row between small">
                  <span className={`pill ${us > them ? "green" : us === them ? "gold" : "red"}`}>{us > them ? "V" : us === them ? "N" : "D"}</span>
                  <span style={{ flex: 1 }}>{name(f.home)} <b>{f.hg}–{f.ag}</b> {name(f.away)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SquadTab() {
  const { club, sellPlayer, renameClub } = useStore();
  const [pos, setPos] = useState<Position | "">("");
  const [rename, setRename] = useState(false);
  const xi = new Set(Object.values(bestEleven(club.players)).flat().map((p) => p.id));
  const list = club.players.filter((p) => !pos || p.pos === pos).sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || b.ovr - a.ovr);
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <Seg value={pos} onChange={setPos} options={[["", "Tous"], ...POSITIONS.map((p) => [p, p] as [Position, string])]} />
        <div className="row">
          <span className="muted small">{club.players.length}/30 joueurs · le meilleur XI joue automatiquement (4-3-3)</span>
          <button className="btn sm" onClick={() => setRename(true)}>🎨 Nom & couleurs</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Poste</th><th>Joueur</th><th className="num">Âge</th><th className="num">Note</th><th className="num">Potentiel</th><th>Progression</th><th className="num">MJ</th><th className="num">Buts</th><th className="num">Valeur</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={xi.has(p.id) ? "me" : ""}>
                <td><span className="pill">{p.pos}</span></td>
                <td>{p.nationality} {p.name} {p.fromAcademy && <span title="Formé au club">🌱</span>}{xi.has(p.id) && <span className="muted small"> · titulaire</span>}</td>
                <td className="num">{p.age}</td>
                <td className="num"><Ovr v={p.ovr} /></td>
                <td className="num"><Ovr v={p.pot} /></td>
                <td style={{ minWidth: 80 }}>{p.ovr < p.pot ? <Bar value={p.xpTrain} max={1} /> : <span className="muted small">max</span>}</td>
                <td className="num">{p.apps}</td>
                <td className="num">{p.goals}</td>
                <td className="num">{fmtMoney(playerValue(p))}</td>
                <td><button className="btn sm ghost" onClick={() => confirm(`Vendre ${p.name} pour ${fmtMoney(sellPrice(p))} ?`) && sellPlayer(p.id)}>Vendre</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rename && <RenameModal onClose={() => setRename(false)} save={renameClub} />}
    </div>
  );
}

function RenameModal({ onClose, save }: { onClose: () => void; save: (n: string, a?: string, b?: string) => void }) {
  const club = useStore((s) => s.club);
  const [n, setN] = useState(club.name);
  const [a, setA] = useState(club.colorA);
  const [b, setB] = useState(club.colorB);
  return (
    <Modal title="Identité du club" onClose={onClose} actions={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={() => { save(n || "Prépa FC", a, b); onClose(); }}>Enregistrer</button></>}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Crest a={a} b={b} />
        <Field label="Nom"><input className="input" value={n} onChange={(e) => setN(e.target.value)} /></Field>
        <Field label="Couleur 1"><input className="input" type="color" value={a} onChange={(e) => setA(e.target.value)} style={{ height: 38, width: 60 }} /></Field>
        <Field label="Couleur 2"><input className="input" type="color" value={b} onChange={(e) => setB(e.target.value)} style={{ height: 38, width: 60 }} /></Field>
      </div>
    </Modal>
  );
}

function MarketTab() {
  const { club, coins, buyPlayer, refreshMarket, sessions } = useStore();
  const [lo, hi] = marketRange(club.facilities.scouting);
  const nextRefresh = Math.max(0, 180 - (totalWorkMinutes(sessions) - club.marketRefreshedAt));
  const xi = bestEleven(club.players);
  const worstStarter = (pos: Position) => {
    const list = xi[pos];
    return list.length < ({ GB: 1, DEF: 4, MIL: 3, ATT: 3 } as const)[pos] ? 0 : Math.min(...list.map((p) => p.ovr));
  };
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="small muted">Recruteurs niv. {club.facilities.scouting} → notes {lo}–{hi}. Nouveaux profils dans {fmtMin(nextRefresh)} de travail.</div>
        <div className="row">
          <span className="chip">💰 {fmtMoney(coins)}</span>
          <button className="btn sm" onClick={refreshMarket}>🔄 Relancer les recruteurs (150 k€)</button>
        </div>
      </div>
      <div className="list">
        {club.market.map((p) => {
          const price = playerValue(p);
          const upgrade = p.ovr - worstStarter(p.pos);
          return (
            <div key={p.id} className="item">
              <Ovr v={p.ovr} />
              <div className="body">
                <div className="title">{p.nationality} {p.name}</div>
                <div className="meta">
                  <span className="pill">{p.pos}</span>
                  <span className="pill">{p.age} ans</span>
                  <span className="pill purple">pot. {p.pot}</span>
                  {upgrade > 0 && <span className="pill green">+{upgrade} sur ton XI</span>}
                </div>
              </div>
              <button className={`btn sm ${coins >= price ? "gold" : ""}`} disabled={coins < price} onClick={() => buyPlayer(p.id)}>
                {fmtMoney(price)}
              </button>
            </div>
          );
        })}
        {club.market.length === 0 && <div className="empty">Le mercato est vide : continue à bosser pour que tes recruteurs trouvent des profils.</div>}
      </div>
    </div>
  );
}

function FacilitiesTab() {
  const { club, coins, upgradeFacility } = useStore();
  return (
    <div className="grid g3">
      {(Object.keys(FACILITIES) as FacilityKey[]).map((k) => {
        const f = FACILITIES[k];
        const lvl = club.facilities[k];
        const max = lvl >= MAX_FACILITY;
        const cost = facilityCost(k, lvl);
        return (
          <div key={k} className="card facility">
            <div className="row between"><span className="icon">{f.icon}</span><span className="stars">{"★".repeat(lvl)}<span style={{ opacity: 0.25 }}>{"★".repeat(MAX_FACILITY - lvl)}</span></span></div>
            <b style={{ fontSize: 16 }}>{f.label}</b>
            <div className="small muted">{f.desc(lvl)}</div>
            {!max && <div className="small">Niveau {lvl + 1} : <span className="muted">{f.desc(lvl + 1)}</span></div>}
            <span className="spacer" />
            <button className={`btn ${coins >= cost && !max ? "gold" : ""}`} disabled={max || coins < cost} onClick={() => upgradeFacility(k)}>
              {max ? "Niveau max" : `Améliorer · ${fmtMoney(cost)}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function LeagueTab() {
  const club = useStore((s) => s.club);
  const table = standings(club.season);
  const div = club.season.division;
  const name = (id: string) => club.season.teams.find((t) => t.id === id)?.name ?? id;
  const [round, setRound] = useState(Math.max(0, club.season.currentRound - 1));
  const r = club.season.rounds[round] ?? [];
  return (
    <div className="grid g2">
      <div className="card">
        <h3>{DIVISIONS[div]} — Saison {club.season.number}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Équipe</th><th className="num">J</th><th className="num">G</th><th className="num">N</th><th className="num">P</th><th className="num">Diff</th><th className="num">Pts</th></tr></thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.id} className={row.isUser ? "me" : ""}>
                  <td style={{ color: i < 2 && div > 0 ? "var(--accent)" : i >= 8 && div < DIVISIONS.length - 1 ? "var(--red)" : undefined }}>{i + 1}</td>
                  <td>{row.name} {!row.isUser && <span className="muted small">({club.season.teams.find((t) => t.id === row.id)?.strength})</span>}</td>
                  <td className="num">{row.p}</td><td className="num">{row.w}</td><td className="num">{row.d}</td><td className="num">{row.l}</td>
                  <td className="num">{row.gf - row.ga > 0 ? "+" : ""}{row.gf - row.ga}</td><td className="num"><b>{row.pts}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Top 2 : promotion · 9e-10e : relégation · prime de fin de saison : {fmtMoney(seasonPrize(1, div))} pour le titre.</p>
      </div>
      <div className="stack">
        <div className="card">
          <h3>Journée <select className="input" style={{ width: "auto" }} value={round} onChange={(e) => setRound(Number(e.target.value))}>
            {club.season.rounds.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
          </select></h3>
          <div className="list">
            {r.map((f, i) => (
              <div key={i} className="row between small" style={{ fontWeight: f.home === "user" || f.away === "user" ? 800 : 400 }}>
                <span style={{ flex: 1, textAlign: "right" }}>{name(f.home)}</span>
                <span className="pill">{f.hg !== undefined ? `${f.hg} – ${f.ag}` : "vs"}</span>
                <span style={{ flex: 1 }}>{name(f.away)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>🏆 Palmarès</h3>
          {club.trophies.length === 0 && club.history.length === 0 && <div className="empty">Ton armoire à trophées t'attend…</div>}
          {club.trophies.map((t, i) => <div key={i}>🏆 Saison {t.season} : {t.label}</div>)}
          {club.history.map((h, i) => <div key={i} className="small muted">Saison {h.season} : {h.rank}e en {DIVISIONS[h.division]}</div>)}
        </div>
      </div>
    </div>
  );
}
