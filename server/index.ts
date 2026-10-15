/**
 * Serveur local de Prépa FC.
 *
 * Rôle : servir de passerelle entre l'appli (navigateur) et Pronote.
 * Pronote n'autorise pas les requêtes directes depuis un navigateur (CORS + chiffrement
 * propriétaire), donc on passe par la librairie `pawnote` côté Node.
 *
 * Aucun mot de passe n'est stocké : après la première connexion, Pronote renvoie un
 * « token » de reconnexion (lié à l'identifiant d'appareil), que l'appli garde côté client.
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pronote from "pawnote";

const app = express();
app.use(express.json({ limit: "1mb" }));

type LoginBody = {
  url: string;
  username: string;
  password?: string;
  token?: string;
  deviceUUID: string;
  /** Contenu JSON du QR code Pronote (alternative aux identifiants, utile si ENT/CAS). */
  qr?: unknown;
  pin?: string;
  /** Plage de dates à synchroniser (ISO). */
  from?: string;
  to?: string;
};

type Lesson = {
  id: string;
  start: string;
  end: string;
  subject: string;
  title?: string;
  teacher?: string;
  room?: string;
  canceled: boolean;
  isTest: boolean;
  status?: string;
  color?: string;
  kind: "lesson" | "activity" | "detention";
};

async function login(body: LoginBody) {
  const session = pronote.createSessionHandle();
  let refresh: pronote.RefreshInformation;
  if (body.qr && body.pin) {
    refresh = await pronote.loginQrCode(session, {
      deviceUUID: body.deviceUUID,
      pin: body.pin,
      qr: body.qr,
    });
  } else if (body.token) {
    refresh = await pronote.loginToken(session, {
      url: body.url,
      kind: pronote.AccountKind.STUDENT,
      username: body.username,
      token: body.token,
      deviceUUID: body.deviceUUID,
    });
  } else if (body.password) {
    refresh = await pronote.loginCredentials(session, {
      url: body.url,
      kind: pronote.AccountKind.STUDENT,
      username: body.username,
      password: body.password,
      deviceUUID: body.deviceUUID,
    });
  } else {
    throw new Error("Il faut un mot de passe, un token ou un QR code + PIN.");
  }
  return { session, refresh };
}

const gradeToNumber = (g?: pronote.GradeValue) =>
  g && g.kind === pronote.GradeKind.Grade ? g.points : null;

async function safe<T>(label: string, fn: () => Promise<T>, warnings: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label} : ${(e as Error).message ?? String(e)}`);
    return null;
  }
}

app.post("/api/pronote/sync", async (req, res) => {
  const body = req.body as LoginBody;
  const warnings: string[] = [];
  try {
    const { session, refresh } = await login(body);
    const from = body.from ? new Date(body.from) : new Date(Date.now() - 7 * 864e5);
    const to = body.to ? new Date(body.to) : new Date(Date.now() + 28 * 864e5);

    // --- Emploi du temps ---
    const lessons: Lesson[] = [];
    const tt = await safe("Emploi du temps", () => pronote.timetableFromIntervals(session, from, to), warnings);
    if (tt) {
      pronote.parseTimetable(session, tt, { withCanceledClasses: true, withPlannedClasses: true, withSuperposedCanceledClasses: false });
      for (const c of tt.classes) {
        if (c.is === "lesson") {
          lessons.push({
            id: c.id,
            start: c.startDate.toISOString(),
            end: c.endDate.toISOString(),
            subject: c.subject?.name ?? "Cours",
            teacher: c.teacherNames.join(", ") || undefined,
            room: c.classrooms.join(", ") || undefined,
            canceled: c.canceled,
            isTest: c.test,
            status: c.status,
            color: c.backgroundColor,
            kind: "lesson",
          });
        } else if (c.is === "activity") {
          lessons.push({
            id: c.id, start: c.startDate.toISOString(), end: c.endDate.toISOString(),
            subject: c.title, title: c.title, canceled: false, isTest: false, color: c.backgroundColor, kind: "activity",
          });
        } else {
          lessons.push({
            id: c.id, start: c.startDate.toISOString(), end: c.endDate.toISOString(),
            subject: c.title ?? "Retenue", canceled: false, isTest: false, color: c.backgroundColor, kind: "detention",
          });
        }
      }
    }

    // --- Devoirs ---
    const rawAssignments = await safe("Devoirs", () => pronote.assignmentsFromIntervals(session, from, to), warnings);
    const assignments = (rawAssignments ?? []).map((a) => ({
      id: a.id,
      subject: a.subject.name,
      description: a.description.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
      deadline: a.deadline.toISOString(),
      done: a.done,
      lengthMin: a.length ?? null,
      color: a.backgroundColor,
    }));

    // --- Notes (toutes les périodes de l'onglet Notes) ---
    const grades: Array<{
      id: string; subject: string; value: number | null; outOf: number | null; coefficient: number;
      date: string; comment: string; classAverage: number | null; max: number | null; min: number | null; period: string;
    }> = [];
    const averages: Array<{ subject: string; student: number | null; classAverage: number | null; period: string; color: string }> = [];
    const gradesTab = session.userResource.tabs.get(pronote.TabLocation.Grades);
    if (gradesTab) {
      for (const period of gradesTab.periods) {
        const ov = await safe(`Notes (${period.name})`, () => pronote.gradesOverview(session, period), warnings);
        if (!ov) continue;
        for (const g of ov.grades) {
          grades.push({
            id: g.id,
            subject: g.subject.name,
            value: gradeToNumber(g.value),
            outOf: gradeToNumber(g.outOf),
            coefficient: g.coefficient,
            date: g.date.toISOString(),
            comment: g.comment,
            classAverage: gradeToNumber(g.average),
            max: gradeToNumber(g.max),
            min: gradeToNumber(g.min),
            period: period.name,
          });
        }
        for (const s of ov.subjectsAverages) {
          averages.push({
            subject: s.subject.name,
            student: gradeToNumber(s.student),
            classAverage: gradeToNumber(s.class_average),
            period: period.name,
            color: s.backgroundColor,
          });
        }
      }
    }

    res.json({
      ok: true,
      refresh: { url: refresh.url, username: refresh.username, token: refresh.token },
      user: {
        name: session.user.name,
        className: session.userResource.className,
        establishment: session.userResource.establishmentName,
      },
      lessons,
      assignments,
      grades,
      averages,
      warnings,
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    const err = e as Error;
    let message = err.message || String(e);
    if (err instanceof pronote.BadCredentialsError) message = "Identifiants incorrects.";
    else if (err instanceof pronote.AccessDeniedError) message = "Accès refusé par Pronote.";
    else if (err instanceof pronote.SuspendedIPError) message = "IP suspendue temporairement par Pronote (trop de tentatives).";
    else if (err instanceof pronote.RateLimitedError) message = "Trop de requêtes, réessaie dans quelques minutes.";
    else if (err instanceof pronote.SessionExpiredError) message = "Session/token expiré : reconnecte-toi avec ton mot de passe ou un QR code.";
    res.status(400).json({ ok: false, error: message, warnings });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// En production : on sert aussi l'appli compilée.
if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Prépa FC API sur http://localhost:${port}`);
});
