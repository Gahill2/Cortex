import { useMemo } from "react";
import {
  Calendar,
  Filter,
  Inbox,
  LayoutGrid,
  List,
  Menu,
  PanelRight,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import type { TaskSortKey } from "../types";
import type { TasksPageTab } from "./TasksPageTabs";

interface Props {
  pageTab: TasksPageTab;
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
  onOpenSidebar?: () => void;
  onOpenInspector?: () => void;
  showInspectorButton?: boolean;
}

export function TasksTopBar({
  pageTab,
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
  onOpenSidebar,
  onOpenInspector,
  showInspectorButton,
}: Props) {
  return (
    <header className="pd-tasks-topbar">
      <div className="pd-tasks-topbar__start">
        {onOpenSidebar ? (
          <button
            type="button"
            className="pd-icon-btn pd-mobile-only"
            onClick={onOpenSidebar}
            aria-label="Open lists"
          >
            <Menu size={18} />
          </button>
        ) : null}
        <Sun size={18} className="pd-tasks-topbar__icon" aria-hidden />
        <div>
          <h1 className="pd-tasks-topbar__title">{title}</h1>
          <p className="pd-tasks-topbar__count">
            {count} {pageTab === "goals" ? (count === 1 ? "goal" : "goals") : count === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>
      <div className="pd-tasks-topbar__center">
        <label className="pd-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder={pageTab === "goals" ? "Search goals…" : "Search tasks…"}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={pageTab === "goals" ? "Search goals" : "Search tasks"}
          />
        </label>
        {pageTab === "tasks" ? <TaskFilters sort={sort} onSortChange={onSortChange} /> : null}
      </div>
      <div className="pd-tasks-topbar__end">
        {showInspectorButton && onOpenInspector ? (
          <button
            type="button"
            className="pd-icon-btn pd-mobile-only"
            onClick={onOpenInspector}
            aria-label="Open task details"
          >
            <PanelRight size={18} />
          </button>
        ) : null}
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
        {pageTab === "tasks" ? (
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
        ) : null}
        <button type="button" className="pd-btn pd-btn--primary pd-btn--sm" onClick={onQuickAdd} disabled={busy}>
          <Plus size={16} />
          {pageTab === "goals" ? "Add goal" : "Add task"}
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

export function getListTitle(listKey: string, pageTab: "tasks" | "goals" = "tasks"): string {
  if (pageTab === "goals") {
    const goalTitles: Record<string, string> = {
      all: "Goals",
      completed: "Completed goals",
    };
    return goalTitles[listKey] ?? "Goals";
  }
  const titles: Record<string, string> = {
    all: "Tasks",
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
export function countByList(
  tasks: { group: string; completed: boolean; hasDueDate?: boolean }[],
  listKey: string,
): number {
  if (listKey === "completed") return tasks.filter((t) => t.completed).length;
  if (listKey === "today") return tasks.filter((t) => t.group === "today" && !t.completed).length;
  if (listKey === "upcoming") return tasks.filter((t) => t.group === "upcoming" && !t.completed).length;
  if (listKey === "inbox") return tasks.filter((t) => !t.completed && !t.hasDueDate).length;
  return tasks.filter((t) => !t.completed).length;
}
