import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Club, CustomEvent, Evaluation, FacilityKey, Grade, Lesson, Plan, PronoteConfig, Session, Task, Toast,
} from "./types";
import {
  MATCH_COST_MIN, MAX_FACILITY, academyEveryHours, academyProspect, applyTraining, bestEleven,
  facilityCost, generateMarket, initialClub, levelFromXp, matchIncome, newSeason, playRound,
  playerValue, resultBonus, seasonOver, seasonPrize, sellPrice, sessionRewards, standings,
  taskCompletionBonus, DIVISIONS,
} from "./game";
import { actualMinutes, currentStreak } from "./insights";
import { isoDay, uid } from "./utils";

export type TimerState = {
  status: "idle" | "running" | "paused";
  mode: "pomodoro" | "free" | "countdown";
  phase: "work" | "break";
  startedAt: number;
  accumulatedMs: number;
  targetMin: number;
  taskId?: string;
  subject?: string;
};

export type PendingSession = { minutes: number; taskId?: string; subject?: string; nextBreak?: boolean };

export type Settings = {
  pomodoroWork: number;
  pomodoroBreak: number;
  subjects: string[];
  dailyGoalMin: number;
  sound: boolean;
};

export type PronoteSyncPayload = {
  user: PronoteConfig["user"];
  refresh: { url: string; username: string; token: string };
  lessons: Lesson[];
  assignments: Array<{ id: string; subject: string; description: string; deadline: string; done: boolean; lengthMin: number | null }>;
  grades: Array<{ id: string; subject: string; value: number | null; outOf: number | null; coefficient: number; date: string; comment: string; classAverage: number | null; period: string }>;
  warnings: string[];
  syncedAt: string;
};

type Data = {
  tasks: Task[];
  evals: Evaluation[];
  sessions: Session[];
  plans: Plan[];
  grades: Grade[];
  lessons: Lesson[];
  customEvents: CustomEvent[];
  pronote: PronoteConfig;
  club: Club;
  xp: number;
  coins: number;
  settings: Settings;
  timer: TimerState;
  pending: PendingSession | null;
};

type Actions = {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  addTask: (t: Omit<Task, "id" | "createdAt" | "done" | "source"> & Partial<Pick<Task, "source" | "pronoteId">>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string, actualMin?: number) => void;
  reopenTask: (id: string) => void;

  addEval: (e: Omit<Evaluation, "id" | "source">) => string;
  updateEval: (id: string, patch: Partial<Evaluation>) => void;
  deleteEval: (id: string) => void;
  setEvalResult: (id: string, note: number) => void;

  addPlan: (p: Omit<Plan, "id">) => string;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  deletePlan: (id: string) => void;

  addGrade: (g: Omit<Grade, "id" | "source">) => void;
  deleteGrade: (id: string) => void;

  addCustomEvent: (e: Omit<CustomEvent, "id">) => void;
  deleteCustomEvent: (id: string) => void;

  // Timer
  startTimer: (opts: { mode: TimerState["mode"]; targetMin: number; taskId?: string; subject?: string; phase?: TimerState["phase"] }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  cancelTimer: () => void;
  logSession: (s: { minutes: number; taskId?: string; subject?: string; focus?: number; note?: string; start?: string }) => void;
  resolvePending: (focus: number | null, note?: string) => void;

  // Club
  buyPlayer: (id: string) => void;
  sellPlayer: (id: string) => void;
  upgradeFacility: (k: FacilityKey) => void;
  refreshMarket: () => void;
  playMatch: () => void;
  renameClub: (name: string, colorA?: string, colorB?: string) => void;

  // Pronote & data
  setPronote: (patch: Partial<PronoteConfig>) => void;
  applyPronoteSync: (p: PronoteSyncPayload) => { tasks: number; evals: number; grades: number };
  updateSettings: (patch: Partial<Settings>) => void;
  importData: (json: string) => void;
  resetAll: () => void;
  loadDemo: (data: Partial<Data>) => void;
};

export type Store = Data & Actions;

const DEFAULT_SUBJECTS = ["Maths", "Économie", "Droit", "Gestion", "Anglais", "LV2", "Culture générale", "Histoire"];

const freshData = (): Data => ({
  tasks: [],
  evals: [],
  sessions: [],
  plans: [],
  grades: [],
  lessons: [],
  customEvents: [],
  pronote: { url: "", username: "", deviceUUID: uid() + uid() },
  club: initialClub(),
  xp: 0,
  coins: 500,
  settings: { pomodoroWork: 25, pomodoroBreak: 5, subjects: DEFAULT_SUBJECTS, dailyGoalMin: 240, sound: true },
  timer: { status: "idle", mode: "pomodoro", phase: "work", startedAt: 0, accumulatedMs: 0, targetMin: 25 },
  pending: null,
});

const KHOLLE_RE = /kh[oô]ll?e|colle\b|interrogation orale/i;

export const totalWorkMinutes = (sessions: Session[]) => sessions.reduce((a, b) => a + b.minutes, 0);

export const timerElapsedMs = (t: TimerState, now = Date.now()) =>
  t.accumulatedMs + (t.status === "running" ? now - t.startedAt : 0);

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const toast: Actions["toast"] = (t) => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        setTimeout(() => get().dismissToast(id), 6000);
      };

      /** Ajoute XP/budget et gère le passage de niveau. */
      const grant = (xp: number, coins: number) => {
        const before = levelFromXp(get().xp).level;
        set((s) => ({ xp: s.xp + xp, coins: s.coins + coins }));
        const after = levelFromXp(get().xp).level;
        if (after > before) {
          const bonus = 200 * after;
          set((s) => ({ coins: s.coins + bonus }));
          toast({ title: `⬆️ Niveau ${after} !`, body: `Prime de la direction : +${bonus} k€`, tone: "gold" });
        }
      };

      return {
        ...freshData(),
        toasts: [],
        toast,
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        // ---------- Tâches ----------
        addTask: (t) => {
          const id = uid();
          set((s) => ({
            tasks: [...s.tasks, { source: "manual", ...t, id, createdAt: new Date().toISOString(), done: false }],
          }));
          return id;
        },
        updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
        completeTask: (id, actualMin) => {
          const s = get();
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return;
          const patched: Task = {
            ...task,
            done: true,
            doneAt: new Date().toISOString(),
            actualMinManual: actualMin ?? task.actualMinManual,
          };
          set({ tasks: s.tasks.map((t) => (t.id === id ? { ...patched, rewarded: true } : t)) });
          if (!task.rewarded) {
            const b = taskCompletionBonus(task.estimateMin, actualMinutes(patched, s.sessions));
            grant(b.xp, b.coins);
            toast({ title: `✅ ${b.label}`, body: `+${b.xp} XP · +${b.coins} k€`, tone: "good" });
          }
        },
        reopenTask: (id) =>
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: false, doneAt: undefined } : t)) })),

        // ---------- Évaluations ----------
        addEval: (e) => {
          const id = uid();
          set((s) => ({ evals: [...s.evals, { ...e, id, source: "manual" }] }));
          return id;
        },
        updateEval: (id, patch) => set((s) => ({ evals: s.evals.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
        deleteEval: (id) =>
          set((s) => ({
            evals: s.evals.filter((e) => e.id !== id),
            tasks: s.tasks.map((t) => (t.evalId === id ? { ...t, evalId: undefined } : t)),
          })),
        setEvalResult: (id, note) => {
          const e = get().evals.find((x) => x.id === id);
          if (!e) return;
          set((s) => ({
            evals: s.evals.map((x) => (x.id === id ? { ...x, result: note, rewarded: true } : x)),
            grades: [
              ...s.grades.filter((g) => g.id !== `eval-${id}`),
              {
                id: `eval-${id}`, subject: e.subject, value: note, outOf: 20,
                coefficient: e.type === "DS" || e.type === "Concours blanc" ? 2 : 1,
                date: e.date, label: `${e.type}${e.topic ? ` — ${e.topic}` : ""}`, source: "manual",
              },
            ],
          }));
          if (!e.rewarded) {
            const b = resultBonus(note, e.type);
            if (b.coins > 0) {
              grant(b.xp, b.coins);
              toast({
                title: note >= 15 ? `🏆 ${note}/20 en ${e.type} !` : `📈 ${note}/20 en ${e.type}`,
                body: `Prime de performance : +${b.xp} XP · +${b.coins} k€`,
                tone: note >= 15 ? "gold" : "good",
              });
            } else toast({ title: `${e.type} : ${note}/20`, body: "On rebondit au prochain. 💪", tone: "info" });
          }
        },

        // ---------- Plans ----------
        addPlan: (p) => {
          const id = uid();
          set((s) => ({ plans: [...s.plans, { ...p, id }] }));
          return id;
        },
        updatePlan: (id, patch) => set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        deletePlan: (id) =>
          set((s) => ({
            plans: s.plans.filter((p) => p.id !== id),
            tasks: s.tasks.map((t) => (t.planId === id ? { ...t, planId: undefined } : t)),
          })),

        addGrade: (g) => set((s) => ({ grades: [...s.grades, { ...g, id: uid(), source: "manual" }] })),
        deleteGrade: (id) => set((s) => ({ grades: s.grades.filter((g) => g.id !== id) })),

        addCustomEvent: (e) => set((s) => ({ customEvents: [...s.customEvents, { ...e, id: uid() }] })),
        deleteCustomEvent: (id) => set((s) => ({ customEvents: s.customEvents.filter((e) => e.id !== id) })),

        // ---------- Timer ----------
        startTimer: ({ mode, targetMin, taskId, subject, phase = "work" }) =>
          set({ timer: { status: "running", mode, phase, startedAt: Date.now(), accumulatedMs: 0, targetMin, taskId, subject } }),
        pauseTimer: () =>
          set((s) =>
            s.timer.status !== "running"
              ? {}
              : { timer: { ...s.timer, status: "paused", accumulatedMs: timerElapsedMs(s.timer) } },
          ),
        resumeTimer: () =>
          set((s) => (s.timer.status !== "paused" ? {} : { timer: { ...s.timer, status: "running", startedAt: Date.now() } })),
        stopTimer: () => {
          const t = get().timer;
          const minutes = Math.floor(timerElapsedMs(t) / 60000);
          const idle: TimerState = { ...t, status: "idle", accumulatedMs: 0, startedAt: 0, phase: "work" };
          if (t.phase === "break") {
            set({ timer: idle });
            return;
          }
          const goBreak = t.mode === "pomodoro" && minutes >= t.targetMin;
          set({
            timer: idle,
            pending: minutes >= 1 ? { minutes, taskId: t.taskId, subject: t.subject, nextBreak: goBreak } : null,
          });
          if (minutes < 1) toast({ title: "Session trop courte", body: "Moins d'1 minute : non comptée.", tone: "warn" });
        },
        cancelTimer: () => set((s) => ({ timer: { ...s.timer, status: "idle", accumulatedMs: 0, startedAt: 0, phase: "work" } })),
        resolvePending: (focus, note) => {
          const p = get().pending;
          if (!p) return;
          set({ pending: null });
          if (focus !== null) get().logSession({ minutes: p.minutes, taskId: p.taskId, subject: p.subject, focus, note });
          if (p.nextBreak) {
            const st = get().settings;
            get().startTimer({ mode: "pomodoro", targetMin: st.pomodoroBreak, phase: "break", taskId: p.taskId, subject: p.subject });
          }
        },

        logSession: ({ minutes, taskId, subject, focus, note, start }) => {
          const s = get();
          const task = taskId ? s.tasks.find((t) => t.id === taskId) : undefined;
          const startIso = start ?? new Date(Date.now() - minutes * 60000).toISOString();
          const provisional: Session = { id: uid(), taskId, subject: subject ?? task?.subject, start: startIso, minutes, focus, xp: 0, coins: 0, note };
          const streak = currentStreak([...s.sessions, provisional]);
          const r = sessionRewards(minutes, { streak, focus, staffLevel: s.club.facilities.staff });
          const session = { ...provisional, xp: r.xp, coins: r.coins };

          // Club : banque de minutes pour les matchs, entraînement, centre de formation, mercato
          const totalBefore = totalWorkMinutes(s.sessions);
          const totalAfter = totalBefore + minutes;
          let club = { ...s.club, matchMinutesBank: s.club.matchMinutesBank + minutes };
          const tr = applyTraining(club.players, minutes / 60, club.facilities.training);
          club.players = tr.players;
          const notes: string[] = [];
          if (tr.ups.length) notes.push(`📈 Progression : ${tr.ups.slice(0, 3).join(", ")}${tr.ups.length > 3 ? "…" : ""}`);
          if (club.facilities.academy > 0) {
            const every = academyEveryHours(club.facilities.academy) * 60;
            if (totalAfter - club.academyLastAt >= every) {
              const p = academyProspect(club.facilities.academy);
              club.players = [...club.players, p];
              club.academyLastAt = totalAfter;
              notes.push(`🌱 Pépite du centre : ${p.name} (${p.pos}, ${p.ovr} → pot. ${p.pot})`);
            }
          }
          if (totalAfter - club.marketRefreshedAt >= 180) {
            club.market = generateMarket(club.facilities.scouting);
            club.marketRefreshedAt = totalAfter;
            notes.push("🔭 Tes recruteurs ont de nouveaux profils au mercato");
          }
          const matchesBefore = Math.floor(s.club.matchMinutesBank / MATCH_COST_MIN);
          const matchesAfter = Math.floor(club.matchMinutesBank / MATCH_COST_MIN);
          if (matchesAfter > matchesBefore) notes.push("⚽ Un match est disponible !");

          set({ sessions: [...s.sessions, session], club });
          grant(r.xp, r.coins);
          toast({
            title: `⏱️ ${minutes} min de travail${streak > 1 ? ` · série ${streak} j 🔥` : ""}`,
            body: [`+${r.xp} XP · +${r.coins} k€`, ...notes].join("\n"),
            tone: "good",
          });
        },

        // ---------- Club ----------
        buyPlayer: (id) => {
          const s = get();
          const p = s.club.market.find((x) => x.id === id);
          if (!p) return;
          const price = playerValue(p);
          if (s.coins < price) return toast({ title: "Budget insuffisant", body: "Il faut bosser un peu plus 😉", tone: "warn" });
          if (s.club.players.length >= 30) return toast({ title: "Effectif plein (30)", body: "Vends un joueur d'abord.", tone: "warn" });
          set({
            coins: s.coins - price,
            club: { ...s.club, players: [...s.club.players, p], market: s.club.market.filter((x) => x.id !== id) },
          });
          toast({ title: `✍️ ${p.name} signe !`, body: `${p.pos} · ${p.ovr} (pot. ${p.pot})`, tone: "gold" });
        },
        sellPlayer: (id) => {
          const s = get();
          const p = s.club.players.find((x) => x.id === id);
          if (!p) return;
          if (s.club.players.length <= 11) return toast({ title: "Il faut au moins 11 joueurs", tone: "warn" });
          const price = sellPrice(p);
          set({ coins: s.coins + price, club: { ...s.club, players: s.club.players.filter((x) => x.id !== id) } });
          toast({ title: `${p.name} vendu`, body: `+${price} k€`, tone: "info" });
        },
        upgradeFacility: (k) => {
          const s = get();
          const lvl = s.club.facilities[k];
          if (lvl >= MAX_FACILITY) return;
          const cost = facilityCost(k, lvl);
          if (s.coins < cost) return toast({ title: "Budget insuffisant", tone: "warn" });
          const club = { ...s.club, facilities: { ...s.club.facilities, [k]: lvl + 1 } };
          if (k === "scouting") club.market = generateMarket(lvl + 1);
          if (k === "academy" && lvl === 0) club.academyLastAt = totalWorkMinutes(s.sessions);
          set({ coins: s.coins - cost, club });
          toast({ title: "🏗️ Travaux terminés", body: `Niveau ${lvl + 1}`, tone: "gold" });
        },
        refreshMarket: () => {
          const s = get();
          const cost = 150;
          if (s.coins < cost) return toast({ title: "Budget insuffisant", tone: "warn" });
          set({ coins: s.coins - cost, club: { ...s.club, market: generateMarket(s.club.facilities.scouting) } });
        },
        playMatch: () => {
          const s = get();
          if (s.club.matchMinutesBank < MATCH_COST_MIN)
            return toast({ title: "Pas encore de match", body: `Encore ${MATCH_COST_MIN - s.club.matchMinutesBank} min de travail.`, tone: "warn" });
          if (bestEleven(s.club.players).GB.length === 0)
            return toast({ title: "Pas de gardien !", body: "Recrute un GB au mercato.", tone: "warn" });
          const { season, userFixture } = playRound(s.club);
          let club: Club = { ...s.club, season, matchMinutesBank: s.club.matchMinutesBank - MATCH_COST_MIN };
          // stats joueurs
          const xi = bestEleven(club.players);
          const starters = new Set(Object.values(xi).flat().map((p) => p.id));
          const scorers = userFixture?.scorers ?? [];
          club.players = club.players.map((p) => ({
            ...p,
            apps: p.apps + (starters.has(p.id) ? 1 : 0),
            goals: p.goals + scorers.filter((x) => x === p.id).length,
          }));
          let coinsGain = 0;
          if (userFixture) {
            const home = userFixture.home === "user";
            const us = home ? userFixture.hg! : userFixture.ag!;
            const them = home ? userFixture.ag! : userFixture.hg!;
            const opp = season.teams.find((t) => t.id === (home ? userFixture.away : userFixture.home))!;
            const names = scorers.map((id) => club.players.find((p) => p.id === id)?.name).filter(Boolean);
            if (us > them) coinsGain = matchIncome(club.facilities.stadium);
            else if (us === them) coinsGain = Math.round(matchIncome(club.facilities.stadium) / 3);
            toast({
              title: `${us > them ? "🟢 Victoire" : us === them ? "🟡 Nul" : "🔴 Défaite"} ${us}–${them} vs ${opp.name}`,
              body: `${names.length ? "⚽ " + names.join(", ") : "Pas de buteur"}${coinsGain ? `\n+${coinsGain} k€ de recette` : ""}`,
              tone: us > them ? "good" : us === them ? "info" : "warn",
            });
          }
          if (seasonOver(club.season)) {
            const table = standings(club.season);
            const rank = table.findIndex((r) => r.isUser) + 1;
            const div = club.season.division;
            const prize = seasonPrize(rank, div);
            coinsGain += prize;
            let nextDiv = div;
            const trophies = [...club.trophies];
            if (rank === 1) trophies.push({ season: club.season.number, label: `Champion — ${DIVISIONS[div]}` });
            if (rank <= 2 && div > 0) nextDiv = div - 1;
            else if (rank >= 9 && div < DIVISIONS.length - 1) nextDiv = div + 1;
            toast({
              title: `🏁 Fin de saison : ${rank}${rank === 1 ? "er" : "e"}`,
              body: `Prime : +${prize} k€${nextDiv < div ? `\n🚀 Promotion en ${DIVISIONS[nextDiv]} !` : nextDiv > div ? `\n⬇️ Relégation en ${DIVISIONS[nextDiv]}` : ""}`,
              tone: rank <= 2 ? "gold" : "info",
            });
            club = {
              ...club,
              trophies,
              history: [...club.history, { season: club.season.number, division: div, rank }],
              players: club.players.map((p) => ({ ...p, age: p.age + 1, pot: p.age >= 30 ? Math.max(p.ovr - 1, p.pot - 2) : p.pot, ovr: p.age >= 31 ? p.ovr - 1 : p.ovr })),
              season: newSeason(club.season.number + 1, nextDiv, club.name),
            };
          }
          set({ club, coins: s.coins + coinsGain });
        },
        renameClub: (name, colorA, colorB) =>
          set((s) => ({
            club: {
              ...s.club,
              name,
              colorA: colorA ?? s.club.colorA,
              colorB: colorB ?? s.club.colorB,
              season: { ...s.club.season, teams: s.club.season.teams.map((t) => (t.isUser ? { ...t, name } : t)) },
            },
          })),

        // ---------- Pronote ----------
        setPronote: (patch) => set((s) => ({ pronote: { ...s.pronote, ...patch } })),
        applyPronoteSync: (p) => {
          const s = get();
          let newTasks = 0;
          let newEvals = 0;
          const tasks = [...s.tasks];
          for (const a of p.assignments) {
            const idx = tasks.findIndex((t) => t.pronoteId === a.id);
            const title = a.description.length > 120 ? a.description.slice(0, 117) + "…" : a.description || `Devoir de ${a.subject}`;
            if (idx >= 0) {
              const t = tasks[idx];
              tasks[idx] = { ...t, title: t.title || title, due: isoDay(a.deadline), done: t.done || a.done, notes: a.description };
            } else {
              newTasks++;
              tasks.push({
                id: uid(), title, subject: a.subject, kind: "devoir", due: isoDay(a.deadline),
                estimateMin: a.lengthMin ?? 45, priority: 2, done: a.done, createdAt: new Date().toISOString(),
                source: "pronote", pronoteId: a.id, notes: a.description, rewarded: a.done,
              });
            }
          }
          const evals = [...s.evals];
          for (const l of p.lessons) {
            if (l.canceled) continue;
            const text = `${l.subject} ${l.title ?? ""} ${l.status ?? ""}`;
            const isKholle = KHOLLE_RE.test(text);
            if (!l.isTest && !isKholle) continue;
            const idx = evals.findIndex((e) => e.pronoteId === l.id);
            const dur = Math.round((+new Date(l.end) - +new Date(l.start)) / 60000);
            const base = {
              type: (isKholle ? "Khôlle" : "DS") as Evaluation["type"],
              subject: l.subject.replace(KHOLLE_RE, "").replace(/\s+/g, " ").trim() || l.subject,
              date: l.start, durationMin: dur, examiner: l.teacher, room: l.room,
            };
            if (idx >= 0) evals[idx] = { ...evals[idx], date: base.date, room: base.room, durationMin: dur };
            else {
              newEvals++;
              evals.push({ ...base, id: uid(), source: "pronote", pronoteId: l.id });
            }
          }
          const grades: Grade[] = [
            ...s.grades.filter((g) => g.source !== "pronote"),
            ...p.grades
              .filter((g) => g.value != null && g.outOf)
              .map((g) => ({
                id: `pn-${g.id}`, subject: g.subject, value: g.value!, outOf: g.outOf!, coefficient: g.coefficient || 1,
                date: g.date, label: g.comment || undefined, classAverage: g.classAverage, source: "pronote" as const, period: g.period,
              })),
          ];
          // matières découvertes
          const subjects = new Set(s.settings.subjects);
          for (const x of [...p.assignments, ...p.grades]) subjects.add(x.subject);
          set({
            tasks,
            evals,
            grades,
            lessons: p.lessons,
            settings: { ...s.settings, subjects: [...subjects] },
            pronote: {
              ...s.pronote,
              url: p.refresh.url,
              username: p.refresh.username,
              token: p.refresh.token,
              lastSync: p.syncedAt,
              user: p.user,
              warnings: p.warnings,
            },
          });
          return { tasks: newTasks, evals: newEvals, grades: p.grades.length };
        },

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        importData: (json) => {
          const data = JSON.parse(json) as Partial<Data>;
          if (!data || typeof data !== "object" || !("club" in data)) throw new Error("Fichier invalide");
          set({ ...freshData(), ...data, pending: null });
        },
        resetAll: () => set({ ...freshData() }),
        loadDemo: (data) => set({ ...freshData(), ...data }),
      };
    },
    {
      name: "prepa-fc-v1",
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as Partial<Store>;
      },
    },
  ),
);

export const exportData = () => {
  const s = useStore.getState();
  const data = Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v !== "function" && k !== "toasts"));
  return JSON.stringify(data, null, 2);
};
