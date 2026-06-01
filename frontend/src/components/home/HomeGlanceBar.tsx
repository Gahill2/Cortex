import { useState } from "react";
import axios from "axios";
import { Sparkles } from "lucide-react";
import type { Tab } from "../../tab";
import { api } from "../../api/client";
import { useDashboardDataContext } from "../../productivity-dashboard/hooks/useDashboardDataContext";
import { useUiCustomization } from "../../hooks/useUiCustomization";
import { formatBriefingText } from "../../lib/formatBriefingText";

interface Props {
  onNavigate: (tab: Tab) => void;
  /** Toolbar-embedded: single row, icon-only briefing */
  compact?: boolean;
  onCommand?: () => void;
}

/** Live stats + optional AI today briefing above the home canvas. */
export function HomeGlanceBar({ onNavigate, compact, onCommand }: Props) {
  const { tasks, todayEvents, tasksLoading, eventsLoading } = useDashboardDataContext();
  const { goals } = useUiCustomization();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingErr, setBriefingErr] = useState<string | null>(null);

  const openTasks = tasks.filter((t) => !t.completed).length;
  const activeGoals = goals.filter((g) => !g.done).length;

  const runBriefing = async () => {
    setBriefingLoading(true);
    setBriefingErr(null);
    setBriefingOpen(true);
    try {
      const payload = {
        goals: goals.map((g) => ({ id: g.id, text: g.text, done: g.done })),
      };
      const r = await api.post<{ data?: { briefing?: string } }>("/ai/today-briefing", payload);
      setBriefing(r.data?.data?.briefing ?? "No briefing returned.");
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data as { error?: { message?: string } })?.error?.message ?? "Briefing unavailable"
        : "Briefing unavailable";
      setBriefingErr(msg);
    } finally {
      setBriefingLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="home-glance home-glance--compact">
        <div className="home-glance__stats">
          <button type="button" className="home-glance__chip" onClick={() => onNavigate("tasks")} title="Open tasks">
            <span className="home-glance__chip-value">{tasksLoading ? "…" : openTasks}</span>
            <span className="home-glance__chip-label">Tasks</span>
          </button>
          <button type="button" className="home-glance__chip" onClick={() => onNavigate("calendar")} title="Open calendar">
            <span className="home-glance__chip-value">{eventsLoading ? "…" : todayEvents.length}</span>
            <span className="home-glance__chip-label">Events</span>
          </button>
          <button type="button" className="home-glance__chip" onClick={() => onNavigate("tasks")} title="Open goals">
            <span className="home-glance__chip-value">{activeGoals}</span>
            <span className="home-glance__chip-label">Goals</span>
          </button>
        </div>
        {onCommand ? (
          <button type="button" className="home-glance__icon-btn" onClick={onCommand} title="Command palette (⌘K)">
            ⌘K
          </button>
        ) : null}
        <div className="home-glance__brief-compact">
          <button
            type="button"
            className="home-glance__icon-btn"
            disabled={briefingLoading}
            onClick={() => void runBriefing()}
            title="Today briefing"
          >
            <Sparkles size={15} aria-hidden />
          </button>
          {briefingOpen && (briefing || briefingErr) ? (
            <div className="home-glance__brief-popover" role="dialog" aria-label="Today briefing">
              <button type="button" className="home-glance__brief-close" onClick={() => setBriefingOpen(false)}>
                ✕
              </button>
              {briefingErr ? (
                <p className="home-glance__brief-err">{briefingErr}</p>
              ) : (
                <p className="home-glance__brief-text">{formatBriefingText(briefing ?? "")}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="home-glance">
      <div className="home-glance__stats">
        <button type="button" className="home-glance__stat" onClick={() => onNavigate("tasks")}>
          <span className="home-glance__value">{tasksLoading ? "…" : openTasks}</span>
          <span className="home-glance__label">Open tasks</span>
        </button>
        <button type="button" className="home-glance__stat" onClick={() => onNavigate("calendar")}>
          <span className="home-glance__value">{eventsLoading ? "…" : todayEvents.length}</span>
          <span className="home-glance__label">Events today</span>
        </button>
        <button type="button" className="home-glance__stat" onClick={() => onNavigate("tasks")}>
          <span className="home-glance__value">{activeGoals}</span>
          <span className="home-glance__label">Active goals</span>
        </button>
      </div>
      <div className="home-glance__brief">
        <button
          type="button"
          className="home-glance__brief-btn"
          disabled={briefingLoading}
          onClick={() => void runBriefing()}
        >
          <Sparkles size={16} aria-hidden />
          {briefingLoading ? "Generating…" : "Today briefing"}
        </button>
        {briefingErr ? <p className="home-glance__brief-err">{briefingErr}</p> : null}
        {briefing ? <p className="home-glance__brief-text">{formatBriefingText(briefing)}</p> : null}
      </div>
    </div>
  );
}
