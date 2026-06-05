import { useMemo } from "react";
import {
  Calendar,
  Filter,
  Inbox,
  LayoutGrid,
  List,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import type { TaskSortKey } from "../types";

interface Props {
  title: string;
  count: number;
  search: string;
  onSearchChange: (q: string) => void;
  sort: TaskSortKey;
  onSortChange: (s: TaskSortKey) => void;
  boardMode: boolean;
  onBoardModeChange: (board: boolean) => void;
  onQuickAdd: () => void;
  busy?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  onOpenGoals?: () => void;
}

export function TasksTopBar({
  title,
  count,
  search,
  onSearchChange,
  sort,
  onSortChange,
  boardMode,
  onBoardModeChange,
  onQuickAdd,
  busy,
  loading,
  onRefresh,
  onOpenGoals,
}: Props) {
  return (
    <header className="pd-tasks-topbar">
      <div className="pd-tasks-topbar__start">
        <Sun size={18} className="pd-tasks-topbar__icon" aria-hidden />
        <div>
          <h1 className="pd-tasks-topbar__title">{title}</h1>
          <p className="pd-tasks-topbar__count">{count} tasks</p>
        </div>
      </div>
      <div className="pd-tasks-topbar__center">
        <label className="pd-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks"
          />
        </label>
        <TaskFilters sort={sort} onSortChange={onSortChange} />
      </div>
      <div className="pd-tasks-topbar__end">
        {onOpenGoals ? (
          <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={onOpenGoals}>
            Goals
          </button>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            className="pd-btn pd-btn--ghost pd-btn--sm"
            onClick={onRefresh}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        ) : null}
        <div className="pd-view-switcher pd-view-switcher--sm" role="group" aria-label="Task layout">
          <button
            type="button"
            className={`pd-view-switcher__btn${!boardMode ? " pd-view-switcher__btn--active" : ""}`}
            onClick={() => onBoardModeChange(false)}
            aria-pressed={!boardMode}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            className={`pd-view-switcher__btn${boardMode ? " pd-view-switcher__btn--active" : ""}`}
            onClick={() => onBoardModeChange(true)}
            aria-pressed={boardMode}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
        <button type="button" className="pd-btn pd-btn--primary pd-btn--sm" onClick={onQuickAdd} disabled={busy}>
          <Plus size={16} />
          Add task
        </button>
      </div>
    </header>
  );
}

function TaskFilters({ sort, onSortChange }: { sort: TaskSortKey; onSortChange: (s: TaskSortKey) => void }) {
  return (
    <label className="pd-sort">
      <Filter size={14} aria-hidden />
      <select value={sort} onChange={(e) => onSortChange(e.target.value as TaskSortKey)} aria-label="Sort tasks">
        <option value="due">Due date</option>
        <option value="priority">Priority</option>
        <option value="title">Title</option>
      </select>
    </label>
  );
}

export function getListTitle(listKey: string): string {
  const titles: Record<string, string> = {
    inbox: "Inbox",
    today: "Today",
    upcoming: "Upcoming",
    anytime: "Anytime",
    someday: "Someday",
    completed: "Completed",
  };
  return titles[listKey] ?? "Tasks";
}

/** Count open tasks for sidebar badges */
export function countByList(tasks: { group: string; completed: boolean }[], listKey: string): number {
  if (listKey === "completed") return tasks.filter((t) => t.completed).length;
  if (listKey === "today") return tasks.filter((t) => t.group === "today" && !t.completed).length;
  if (listKey === "upcoming") return tasks.filter((t) => t.group === "upcoming" && !t.completed).length;
  if (listKey === "inbox") return tasks.filter((t) => !t.completed).length;
  return tasks.filter((t) => !t.completed).length;
}
