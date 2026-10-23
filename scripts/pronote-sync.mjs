#!/usr/bin/env node
/**
 * Synchronisation Pronote pour la tâche du soir (exécutée depuis la session Claude, pas depuis l'iPad).
 *
 *   node scripts/pronote-sync.mjs <auth.json> <sortie.json>
 *
 * auth.json : { deviceUUID, url?, username?, token? }  ou, la première fois, { deviceUUID, qr, pin }
 *   - qr : contenu JSON du QR code Pronote (Mon profil → QR code pour l'application mobile), pin : les 4 chiffres choisis.
 * sortie.json : { refresh, pack, summary, warnings }
 *   - refresh : nouvelles infos de connexion (le token change à chaque connexion, il faut le garder pour la fois suivante)
 *   - pack : paquet au format de l'appli (notes, devoirs → to-do, emploi du temps), à déposer dans la boîte de réception.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as pronote from "pawnote";
import { defaultFetcher } from "@literate.ink/utilities";

const [, , authPath, outPath] = process.argv;
if (!authPath || !outPath) {
  console.error("Usage : node scripts/pronote-sync.mjs <auth.json> <sortie.json>");
  process.exit(2);
}
const auth = JSON.parse(readFileSync(authPath, "utf8"));
const warnings = [];
const safe = async (label, fn) => {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label} : ${e?.message ?? e}`);
    return null;
  }
};
const iso = (d) => new Date(d).toISOString();
const day = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const num = (g) => (g && g.kind === pronote.GradeKind.Grade ? g.points : null);

/** Noms Pronote → matières de l'appli (mêmes noms que les coefficients du bulletin). */
function subjectOf(name, outOf) {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (n.includes("APPROF")) return outOf === 20 ? "Approf. méthodo › Entretien écrit" : "Approf. méthodo › Tests d'actu";
  if (n.startsWith("MATH")) return "Maths";
  if (n.includes("MACRO")) return "Macroéconomie";
  if (n.includes("MICRO")) return "Microéconomie";
  if (n.includes("GESTION")) return "Gestion";
  if (n.includes("ANGLAIS")) return "Anglais";
  if (n.includes("ESPAGNOL")) return "Espagnol";
  if (n.includes("ECONOMIE")) return "Économie";
  return name.charAt(0) + name.slice(1).toLowerCase();
}

async function login() {
  const session = pronote.createSessionHandle((req) => {
    if (process.env.PN_DEBUG) console.error("REQ", String(req.url).replace(/login=[^&]*/, "login=…"), req.method ?? "GET");
    return defaultFetcher(req).then((r) => {
      // Pronote 2026 écrit « Start ({…});} catch » : pawnote 1.6 attend « Start ({…})} catch ».
      if (typeof r.content === "string") r.content = r.content.replace(/(Start\s*\(\{[^}]*\}\))\s*;\s*\}/, "$1}"); if (process.env.PN_DEBUG) console.error("RES", r.status, String(r.content).slice(0, 120).replace(/\s+/g, " ")); return r; });
  });
  let refresh;
  if (auth.qr && auth.pin) {
    refresh = await pronote.loginQrCode(session, { deviceUUID: auth.deviceUUID, pin: String(auth.pin), qr: typeof auth.qr === "string" ? JSON.parse(auth.qr) : auth.qr });
  } else if (auth.token) {
    refresh = await pronote.loginToken(session, {
      url: auth.url, kind: pronote.AccountKind.STUDENT, username: auth.username, token: auth.token, deviceUUID: auth.deviceUUID,
    });
  } else throw new Error("Ni QR code + PIN, ni token : impossible de se connecter.");
  return { session, refresh };
}

let session, refresh;
try {
  ({ session, refresh } = await login());
} catch (e) {
  // Message court et lisible pour la tâche du soir (pas de pile d'appels minifiée)
  console.error(`ÉCHEC connexion Pronote : ${e?.name ?? "Erreur"} — ${e?.message ?? e}`);
  process.exit(1);
}
const now = new Date();
const from = new Date(now.getTime() - 2 * 864e5);
const to = new Date(now.getTime() + 35 * 864e5);

// --- Notes, toutes périodes ---
const grades = [];
const tab = session.userResource.tabs.get(pronote.TabLocation.Grades);
for (const period of tab?.periods ?? []) {
  const ov = await safe(`Notes (${period.name})`, () => pronote.gradesOverview(session, period));
  for (const g of ov?.grades ?? []) {
    const value = num(g.value), outOf = num(g.outOf);
    if (value == null || !outOf) continue; // absent, dispensé, non noté
    grades.push({
      id: `pn-${g.id}`, subject: subjectOf(g.subject.name, outOf), value, outOf, coefficient: g.coefficient || 1,
      date: iso(g.date), label: g.comment || undefined, classAverage: num(g.average), source: "pronote", period: period.name,
    });
  }
}

// --- Devoirs → to-do ---
const tasks = [];
const hw = await safe("Devoirs", () => pronote.assignmentsFromIntervals(session, from, to));
for (const a of hw ?? []) {
  const text = a.description.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  tasks.push({
    id: `pn-hw-${a.id}`, title: text.length > 140 ? `${text.slice(0, 137)}…` : text || "Devoir", subject: subjectOf(a.subject.name, null),
    kind: "devoir", due: day(a.deadline), estimateMin: a.length ?? 30, priority: 2, done: a.done, createdAt: now.toISOString(),
    source: "pronote", pronoteId: a.id,
  });
}

// --- Emploi du temps ---
const lessons = [];
const tt = await safe("Emploi du temps", () => pronote.timetableFromIntervals(session, from, to));
if (tt) {
  pronote.parseTimetable(session, tt, { withCanceledClasses: true, withPlannedClasses: true, withSuperposedCanceledClasses: false });
  for (const c of tt.classes) {
    const base = { id: `pn-l-${c.id}`, start: iso(c.startDate), end: iso(c.endDate), color: c.backgroundColor };
    if (c.is === "lesson")
      lessons.push({ ...base, subject: subjectOf(c.subject?.name ?? "Cours", null), teacher: c.teacherNames.join(", ") || undefined, room: c.classrooms.join(", ") || undefined, canceled: c.canceled, isTest: c.test, status: c.status, kind: "lesson" });
    else if (c.is === "activity") lessons.push({ ...base, subject: c.title, title: c.title, canceled: false, isTest: false, kind: "activity" });
  }
}

const pack = { id: `pronote-${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}`, grades, tasks, lessons, pronoteDays: lessons.length ? [day(from), day(to)] : undefined };
writeFileSync(outPath, JSON.stringify({
  refresh: { url: refresh.url, username: refresh.username, token: refresh.token, deviceUUID: auth.deviceUUID },
  user: { name: session.user.name, className: session.userResource.className },
  pack,
  summary: `${grades.length} notes, ${tasks.length} devoirs, ${lessons.length} cours`,
  warnings,
}, null, 1));
console.log(`OK ${session.user.name} · ${grades.length} notes · ${tasks.length} devoirs · ${lessons.length} cours${warnings.length ? ` · ${warnings.length} avertissement(s)` : ""}`);
