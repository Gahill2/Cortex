import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../tab";
import { FormField } from "../components/ui/FormField";
import { useUiCustomization } from "../hooks/useUiCustomization";
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
  const [tasks, setTasks] = useState<HomeBoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>();
  const [estimateDraft, setEstimateDraft] = useState("4");

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
        const t: HomeBoardTask[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
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
    if (!text) {
      setDraftError("Goal description is required.");
      return;
    }
    setDraftError(undefined);
    const hours = Math.max(0.5, Number(estimateDraft) || 4);
    const row: CortexGoal = {
      id: crypto.randomUUID(),
      text,
      done: false,
      estimateHours: hours,
      progressPercent: 0,
    };
    setGoals([...goals, row]);
    setDraft("");
  };

  const updateGoal = (id: string, patch: Partial<CortexGoal>) => {
    setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  return (
    <div className="page goals-page">
      <header className="goals-page-header">
        <div>
          <h1 className="goals-page-title">Goals &amp; progress</h1>
          <p className="goals-page-sub">
            Track outcomes separately from the day planner. Tasks &amp; Calendar handles schedule and
            execution.
          </p>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => onNavigate("tasks")}>
          Open Tasks &amp; Calendar
        </button>
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

      <section className="goals-panel">
        <h2 className="goals-panel-title">Your goals</h2>
        <form className="goals-add-row" onSubmit={addGoal}>
          <FormField label="New goal" required error={draftError}>
            <input
              className="form-input goals-add-input"
              placeholder="New goal…"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); if (draftError) setDraftError(undefined); }}
            />
          </FormField>
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
          <button type="submit" className="btn-primary btn-sm" style={{ alignSelf: "flex-end" }}>
            Add
          </button>
        </form>

        <ul className="goals-list">
          {goals.length === 0 && (
            <li className="goals-empty">No goals yet — add one above or migrate from an older home board.</li>
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
        <h2 className="goals-panel-title">Task snapshot</h2>
        <p className="goals-panel-desc">
          {taskStats.done} completed · {taskStats.open} open — use the planner for due dates and calendar
          blocks.
        </p>
        <ul className="goals-task-mini-list">
          {tasks
            .filter((t) => t.status !== "DONE")
            .slice(0, 8)
            .map((t) => (
              <li key={t.id}>
                <span className="goals-task-title">{t.title}</span>
                <span className="goals-task-project">{t.project?.name ?? "—"}</span>
              </li>
            ))}
          {!loading && taskStats.open === 0 && (
            <li className="goals-empty">No open tasks — nice work.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
