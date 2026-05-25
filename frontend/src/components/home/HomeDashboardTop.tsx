import { FormEvent, useMemo, useState } from "react";
import axios from "axios";
import type { Tab } from "../../App";
import { api } from "../../api/client";
import { GlassPanel } from "../ui/GlassPanel";
import { usePersistentState } from "../../hooks/usePersistentState";

export type HomeBoardTask = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  updatedAt?: string;
  project: { name: string };
};

type HomeGoal = { id: string; text: string; done: boolean };

const GOALS_KEY = "cortex_home_goals";

const QUICK_LINKS: Array<{ tab: Tab; label: string }> = [
  { tab: "tasks", label: "Tasks & Calendar" },
  { tab: "mail", label: "Mail" },
  { tab: "notes", label: "Notes" },
  { tab: "ai", label: "AI" },
  { tab: "spotify", label: "Music" },
  { tab: "settings", label: "Settings" },
];

function fmtDueShort(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.floor((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOpen(t: HomeBoardTask) {
  return t.status === "TODO" || t.status === "IN_PROGRESS";
}

type Props = {
  onNavigate: (t: Tab) => void;
  tasks: HomeBoardTask[];
  projectsCount: number;
  loading: boolean;
};

export function HomeDashboardTop({ onNavigate, tasks, projectsCount, loading }: Props) {
  const [goals, setGoals] = usePersistentState<HomeGoal[]>(GOALS_KEY, []);
  const [goalDraft, setGoalDraft] = useState("");

  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [briefingErr, setBriefingErr] = useState<string | null>(null);
  const [briefingGmailConnected, setBriefingGmailConnected] = useState<boolean | null>(null);
  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState<string | null>(null);

  const stats = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "TODO").length;
    const inProg = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const open = todo + inProg;
    return { todo, inProg, done, open, total: tasks.length };
  }, [tasks]);

  const dueSoon = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((t) => isOpen(t) && t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 6)
      .map((t) => ({
        task: t,
        overdue: new Date(t.dueDate!) < now && t.status !== "DONE",
      }));
  }, [tasks]);

  const recent = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [tasks]);

  const addGoal = (e: FormEvent) => {
    e.preventDefault();
    const text = goalDraft.trim();
    if (!text) return;
    setGoals((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setGoalDraft("");
  };

  const toggleGoal = (id: string) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  };

  const removeGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const runTodayBriefing = async (opts?: { keepPreviousOnError?: boolean }) => {
    setBriefingErr(null);
    setBriefingLoading(true);
    try {
      const payload = {
        goals: goals.map((g) => ({ text: g.text, done: g.done })),
      };
      const r = await api.post("/ai/today-briefing", payload);
      const d = (r.data as { data?: { briefing?: string; gmailConnected?: boolean; generatedAt?: string } }).data;
      setBriefingText(typeof d?.briefing === "string" ? d.briefing : "");
      setBriefingGmailConnected(typeof d?.gmailConnected === "boolean" ? d.gmailConnected : null);
      setBriefingGeneratedAt(d?.generatedAt ?? null);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 401) {
          setBriefingErr("Session expired — sign in again from Login.");
        } else if (!e.response) {
          setBriefingErr("Network error — check that the Cortex API is reachable.");
        } else {
          const msg = (e.response.data as { error?: { message?: string } })?.error?.message;
          setBriefingErr(msg ?? `Request failed (${e.response.status}).`);
        }
      } else {
        setBriefingErr("Could not generate briefing.");
      }
      if (!opts?.keepPreviousOnError) setBriefingText(null);
    } finally {
      setBriefingLoading(false);
    }
  };

  const openBriefing = () => {
    setBriefingOpen(true);
    setBriefingText(null);
    setBriefingErr(null);
    setBriefingGmailConnected(null);
    void runTodayBriefing();
  };

  return (
    <section className="home-dash-rail" aria-label="Dashboard overview">
      <div className="home-briefing-hero mb-3 mb-lg-4">
        <GlassPanel as="div" className="home-briefing-hero-panel">
          <div className="home-briefing-hero-inner">
            <div>
              <h2 className="home-briefing-hero-title">Today&apos;s briefing</h2>
              <p className="home-briefing-hero-sub">
                Scan goals, tasks, projects, and inbox (when Gmail is linked) into one Jarvis-style summary.
              </p>
            </div>
            <button type="button" className="btn-primary home-briefing-hero-btn" onClick={openBriefing}>
              Open briefing
            </button>
          </div>
        </GlassPanel>
      </div>

      {briefingOpen ? (
        <div
          className="home-briefing-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Today's briefing"
          onClick={() => setBriefingOpen(false)}
        >
          <div className="home-briefing-modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="home-briefing-modal-head">
              <h2 className="home-briefing-modal-title">Today&apos;s briefing</h2>
              <button type="button" className="home-briefing-modal-close" aria-label="Close" onClick={() => setBriefingOpen(false)}>
                ×
              </button>
            </div>
            <div className="home-briefing-modal-toolbar">
              <button type="button" className="btn-ghost btn-sm" disabled={briefingLoading} onClick={() => void runTodayBriefing({ keepPreviousOnError: true })}>
                {briefingLoading ? "Refreshing…" : "Refresh"}
              </button>
              {briefingGeneratedAt ? (
                <span className="home-briefing-generated">
                  Updated {new Date(briefingGeneratedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
            {briefingGmailConnected === false ? (
              <p className="home-briefing-mail-hint">
                Gmail isn&apos;t connected — the summary below uses goals and Cortex tasks only. Link mail in{" "}
                <button type="button" className="home-briefing-inline-link" onClick={() => { setBriefingOpen(false); onNavigate("mail"); }}>
                  Mail
                </button>{" "}
                or{" "}
                <button type="button" className="home-briefing-inline-link" onClick={() => { setBriefingOpen(false); onNavigate("settings"); }}>
                  Settings
                </button>
                .
              </p>
            ) : null}
            {briefingLoading && !briefingText ? <p className="home-dash-muted">Scanning your workspace…</p> : null}
            {briefingErr ? <p className="home-briefing-error">{briefingErr}</p> : null}
            {briefingText ? (
              <div className="home-briefing-body">{briefingText}</div>
            ) : !briefingLoading && !briefingErr ? (
              <p className="home-dash-muted">No content yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="row g-3 g-lg-3 mb-3 mb-lg-4">
        <div className="col-12 col-lg-5">
          <GlassPanel as="section" className="home-dash-panel home-dash-panel--goals">
            <div className="home-dash-panel-head">
              <h2 className="home-dash-panel-title">Goals</h2>
              <p className="home-dash-panel-sub">Personal focus — stored on this device</p>
            </div>
            <form className="home-goal-form" onSubmit={addGoal}>
              <input
                className="form-input home-goal-input"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder="Add a goal…"
                maxLength={240}
                aria-label="New goal"
              />
              <button type="submit" className="btn-primary btn-sm" disabled={!goalDraft.trim()}>
                Add
              </button>
            </form>
            {goals.length === 0 ? (
              <p className="home-dash-muted mb-0">
                No goals yet. Add outcomes you care about this week; they stay in your browser until you clear them.
              </p>
            ) : (
              <ul className="home-goal-list">
                {goals.map((g) => (
                  <li key={g.id} className={`home-goal-row ${g.done ? "home-goal-row--done" : ""}`}>
                    <label className="home-goal-label">
                      <input type="checkbox" checked={g.done} onChange={() => toggleGoal(g.id)} />
                      <span>{g.text}</span>
                    </label>
                    <button type="button" className="home-goal-remove" aria-label="Remove goal" onClick={() => removeGoal(g.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>

        <div className="col-12 col-lg-7 d-flex flex-column gap-3">
          <GlassPanel as="section" className="home-dash-panel home-dash-panel--stats">
            <div className="home-dash-panel-head home-dash-panel-head--inline">
              <h2 className="home-dash-panel-title">At a glance</h2>
              {loading ? <span className="home-dash-muted"><span className="inline-loading-spinner inline-loading-spinner--sm" aria-hidden="true" /> Loading…</span> : null}
            </div>
            <div className="home-stat-grid">
              <button type="button" className="home-stat-tile" onClick={() => onNavigate("tasks")}>
                <span className="home-stat-value">{loading ? "—" : projectsCount}</span>
                <span className="home-stat-label">Projects</span>
              </button>
              <button type="button" className="home-stat-tile" onClick={() => onNavigate("tasks")}>
                <span className="home-stat-value">{loading ? "—" : stats.open}</span>
                <span className="home-stat-label">Open tasks</span>
              </button>
              <button type="button" className="home-stat-tile" onClick={() => onNavigate("tasks")}>
                <span className="home-stat-value">{loading ? "—" : stats.todo}</span>
                <span className="home-stat-label">To do</span>
              </button>
              <button type="button" className="home-stat-tile" onClick={() => onNavigate("tasks")}>
                <span className="home-stat-value">{loading ? "—" : stats.inProg}</span>
                <span className="home-stat-label">In progress</span>
              </button>
              <button type="button" className="home-stat-tile" onClick={() => onNavigate("tasks")}>
                <span className="home-stat-value">{loading ? "—" : stats.done}</span>
                <span className="home-stat-label">Done</span>
              </button>
            </div>
            <div className="home-quick-row">
              {QUICK_LINKS.map((q) => (
                <button key={q.tab} type="button" className="home-quick-pill" onClick={() => onNavigate(q.tab)}>
                  {q.label}
                </button>
              ))}
            </div>
          </GlassPanel>

          <div className="row g-3 flex-grow-1">
            <div className="col-12 col-md-6">
              <GlassPanel as="section" className="home-dash-panel home-dash-panel--list h-100">
                <h3 className="home-dash-list-title">Due soon</h3>
                {loading ? (
                  <p className="home-dash-muted mb-0">Loading tasks…</p>
                ) : dueSoon.length === 0 ? (
                  <p className="home-dash-muted mb-0">No dated open tasks. Add due dates in Tasks.</p>
                ) : (
                  <ul className="home-dash-task-list">
                    {dueSoon.map(({ task: t, overdue }) => (
                      <li key={t.id}>
                        <button type="button" className="home-dash-task-line" onClick={() => onNavigate("tasks")}>
                          <span className={`home-dash-due ${overdue ? "home-dash-due--over" : ""}`}>
                            {t.dueDate ? fmtDueShort(t.dueDate) : ""}
                          </span>
                          <span className="home-dash-task-title">{t.title}</span>
                          <span className="home-dash-task-meta">{t.project.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>
            <div className="col-12 col-md-6">
              <GlassPanel as="section" className="home-dash-panel home-dash-panel--list h-100">
                <h3 className="home-dash-list-title">Recent tasks</h3>
                {loading ? (
                  <p className="home-dash-muted mb-0"><span className="inline-loading-spinner inline-loading-spinner--sm" aria-hidden="true" /> Loading…</p>
                ) : recent.length === 0 ? (
                  <p className="home-dash-muted mb-0">No tasks yet — create one in Tasks.</p>
                ) : (
                  <ul className="home-dash-task-list">
                    {recent.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="home-dash-task-line" onClick={() => onNavigate("tasks")}>
                          <span className={`home-dash-status home-dash-status--${t.status.toLowerCase()}`}>
                            {t.status === "TODO" ? "Todo" : t.status === "IN_PROGRESS" ? "Doing" : "Done"}
                          </span>
                          <span className="home-dash-task-title">{t.title}</span>
                          <span className="home-dash-task-meta">{t.project.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
