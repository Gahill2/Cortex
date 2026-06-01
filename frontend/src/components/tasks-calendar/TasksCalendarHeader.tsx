import type { Tab } from "../../tab";
import { TccIconCalendarPlus, TccIconPlus, TccIconSearch } from "./TccIcons";

interface Props {
  search: string;
  onSearchChange: (q: string) => void;
  onNewTask: () => void;
  onNewEvent: () => void;
  onNavigate?: (tab: Tab) => void;
  loading?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
}

export function TasksCalendarHeader({
  search,
  onSearchChange,
  onNewTask,
  onNewEvent,
  onNavigate,
  loading = false,
  busy = false,
  onRefresh,
}: Props) {
  return (
    <header className="page-titlebar tcc-header">
      <div className="tcc-header-titles">
        <h1 className="page-title">Tasks &amp; Calendar</h1>
        <p className="page-subtitle">Schedule, tasks, and focus — calendar and planner in one workspace.</p>
      </div>
      <div className="page-actions tcc-header-actions">
        <label className="tcc-search">
          <TccIconSearch />
          <input
            type="search"
            placeholder="Search tasks and events…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks and events"
          />
          {search ? (
            <button
              type="button"
              className="tcc-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          ) : null}
        </label>
        {onNavigate ? (
          <button type="button" className="teams-btn teams-btn--ghost" onClick={() => onNavigate("tasks")}>
            Goals
          </button>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            className="teams-btn teams-btn--ghost"
            onClick={onRefresh}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        ) : null}
        <button
          type="button"
          className="teams-btn teams-btn--ghost"
          onClick={onNewTask}
          disabled={busy}
        >
          <TccIconPlus />
          New Task
        </button>
        <button type="button" className="teams-btn teams-btn--primary" onClick={onNewEvent}>
          <TccIconCalendarPlus />
          New Event
        </button>
      </div>
    </header>
  );
}
