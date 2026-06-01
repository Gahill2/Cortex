import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../tab";
import { useUiCustomization } from "../hooks/useUiCustomization";
import { usePreferences } from "../context/PreferencesContext";
import type { CortexGoal } from "../lib/uiCustomization";
import {
  formatEtc,
  goalEstimatedCompletion,
  goalProgress,
} from "../lib/uiCustomization";
import type { HomeBoardTask } from "../components/home/HomeDashboardTop";

const LEGACY_GOALS_KEY = "cortex_home_goals";

type Props = {
  onNavigate: (tab: Tab) => void;
};

export function GoalsPage({ onNavigate }: Props) {
  const { goals, setGoals } = useUiCustomization();
  const { ready: prefsReady } = usePreferences();
  const [tasks, setTasks] = useState<HomeBoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [estimateDraft, setEstimateDraft] = useState("4");
  const [targetDraft, setTargetDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEGACY_GOALS_KEY);
      if (raw && goals.length === 0) {
        const parsed = JSON.parse(raw) as Array<{ id: string; text: string; done: boolean }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGoals(
            parsed.map((g) => ({
              id: g.id,
              text: g.text,
              done: g.done,
              estimateHours: 4,
              progressPercent: g.done ? 100 : 0,
            })),
          );
          localStorage.removeItem(LEGACY_GOALS_KEY);
        }
      }
    } catch {
      /* ignore */
    }
  }, [goals.length, setGoals]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .get("/tasks")
      .then((r) => {
        if (cancelled) return;
        const body = r.data as { data?: HomeBoardTask[] } | HomeBoardTask[];
        const t: HomeBoardTask[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : [];
        setTasks(t);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const taskStats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "DONE");
    const done = tasks.filter((t) => t.status === "DONE");
    return { open: open.length, done: done.length, total: tasks.length };
  }, [tasks]);

  const goalStats = useMemo(() => {
    const active = goals.filter((g) => !g.done);
    const avg =
      active.length === 0
        ? 0
        : Math.round(active.reduce((s, g) => s + goalProgress(g), 0) / active.length);
    const nextEtc = active
      .map((g) => goalEstimatedCompletion(g))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return { active: active.length, avg, nextEtc };
  }, [goals]);

  const addGoal = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const hours = Math.max(0.5, Number(estimateDraft) || 4);
    const row: CortexGoal = {
      id: crypto.randomUUID(),
      text,
      done: false,
      estimateHours: hours,
      progressPercent: 0,
      targetDate: targetDraft ? new Date(`${targetDraft}T12:00:00`).toISOString() : undefined,
    };
    setGoals([...goals, row]);
    setDraft("");
    setTargetDraft("");
  };

  const updateGoal = (id: string, patch: Partial<CortexGoal>) => {
    setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  if (!prefsReady) {
    return (
      <div className="page goals-page">
        <p className="goals-loading" aria-busy="true">
          Loading goals…
        </p>
      </div>
    );
  }

  return (
    <div className="page goals-page">
      <header className="goals-page-header">
        <div>
          <h1 className="goals-page-title">Goals &amp; progress</h1>
          <p className="goals-page-sub">
            Long-term outcomes live here. Use Tasks for day-to-day execution and Calendar for time blocks.
          </p>
        </div>
        <div className="goals-page-header__actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => onNavigate("home")}>
            Home
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => onNavigate("tasks")}>
            Open Tasks
          </button>
        </div>
      </header>

      <div className="goals-summary-grid">
        <div className="goals-summary-card">
          <p className="goals-summary-label">Active goals</p>
          <p className="goals-summary-value">{goalStats.active}</p>
        </div>
        <div className="goals-summary-card">
          <p className="goals-summary-label">Avg progress</p>
          <p className="goals-summary-value">{goalStats.avg}%</p>
        </div>
        <div className="goals-summary-card">
          <p className="goals-summary-label">Next ETC</p>
          <p className="goals-summary-value goals-summary-value--sm">
            {formatEtc(goalStats.nextEtc ?? null)}
          </p>
        </div>
        <div className="goals-summary-card">
          <p className="goals-summary-label">Open tasks</p>
          <p className="goals-summary-value">{loading ? "…" : taskStats.open}</p>
        </div>
      </div>

      <div className="goals-panels">
        <section className="goals-panel">
          <h2 className="goals-panel-title">Your goals</h2>
          <form className="goals-add-row" onSubmit={addGoal}>
            <input
              className="form-input goals-add-input"
              placeholder="What are you working toward?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <label className="goals-estimate-label">
              Est. hours
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="form-input goals-estimate-input"
                value={estimateDraft}
                onChange={(e) => setEstimateDraft(e.target.value)}
              />
            </label>
            <label className="goals-estimate-label">
              Target date
              <input
                type="date"
                className="form-input goals-estimate-input"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary btn-sm" disabled={!draft.trim()}>
              Add goal
            </button>
          </form>

          <ul className="goals-list">
            {goals.length === 0 && (
              <li className="goals-empty">No goals yet — add one above to track progress over time.</li>
            )}
            {goals.map((g) => {
              const pct = goalProgress(g);
              const etc = goalEstimatedCompletion(g);
              return (
                <li key={g.id} className={`goals-card${g.done ? " goals-card--done" : ""}`}>
                  <div className="goals-card-top">
                    <label className="goals-card-check">
                      <input
                        type="checkbox"
                        checked={g.done}
                        onChange={() =>
                          updateGoal(g.id, {
                            done: !g.done,
                            progressPercent: !g.done ? 100 : g.progressPercent ?? 0,
                          })
                        }
                      />
                      <span className="goals-card-text">{g.text}</span>
                    </label>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => removeGoal(g.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="goals-progress-track" aria-hidden>
                    <div className="goals-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="goals-card-meta">
                    <label className="goals-meta-field">
                      Progress
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pct}
                        disabled={g.done}
                        onChange={(e) =>
                          updateGoal(g.id, { progressPercent: Number(e.target.value), done: false })
                        }
                      />
                    </label>
                    <span className="goals-meta-pill">ETC {formatEtc(etc)}</span>
                    {g.targetDate ? (
                      <span className="goals-meta-pill">
                        Target{" "}
                        {new Date(g.targetDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="goals-panel goals-panel--tasks">
          <h2 className="goals-panel-title">Open tasks</h2>
          <p className="goals-panel-desc">
            {taskStats.done} completed · {taskStats.open} open — click a task to open the planner.
          </p>
          <ul className="goals-task-mini-list">
            {tasks
              .filter((t) => t.status !== "DONE")
              .slice(0, 10)
              .map((t) => (
                <li key={t.id}>
                  <button type="button" className="goals-task-link" onClick={() => onNavigate("tasks")}>
                    <span className="goals-task-title">{t.title}</span>
                    <span className="goals-task-project">{t.project?.name ?? "—"}</span>
                  </button>
                </li>
              ))}
            {!loading && taskStats.open === 0 && (
              <li className="goals-empty">No open tasks — add work in Tasks.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
