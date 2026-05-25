import { ArrowRight, CheckSquare } from "lucide-react";
import type { Tab } from "../../../App";
import type { HomeBoardTask } from "../HomeDashboardTop";

export function TasksWidget({
  onNavigate,
  tasks,
  loading,
  previewLimit = 4,
}: {
  onNavigate: (t: Tab) => void;
  tasks: HomeBoardTask[];
  loading?: boolean;
  previewLimit?: number;
}) {
  const todo = tasks.filter((t) => t.status === "TODO");
  const inProg = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");
  const total = tasks.length;
  const doneCount = done.length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const remaining = todo.length + inProg.length;

  const priorityDot = (status: HomeBoardTask["status"]) => {
    if (status === "IN_PROGRESS") return "task-priority-dot--high";
    if (status === "TODO") return "task-priority-dot--medium";
    return "task-priority-dot--low";
  };

  return (
    <div
      className="widget widget--tasks"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate("tasks");
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate("tasks");
        }
      }}
    >
      <div className="widget-label widget-label--icon">
        <CheckSquare size={16} strokeWidth={1.75} aria-hidden />
        <span>Tasks</span>
      </div>
      {loading ? <p className="widget-empty"><span className="inline-loading-spinner inline-loading-spinner--sm" aria-hidden="true" /> Loading…</p> : null}
      {!loading && total > 0 && (
        <div className="task-progress-bar">
          <div className="task-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
      <ul className="widget-task-list">
        {!loading &&
          [...inProg, ...todo].slice(0, previewLimit).map((t) => (
            <li
              key={t.id}
              className={`widget-task-item ${t.status === "IN_PROGRESS" ? "widget-task-item--active" : ""}`}
              style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
            >
              <span className={`task-priority-dot ${priorityDot(t.status)}`} />
              <span className="widget-task-title">{t.title}</span>
            </li>
          ))}
        {!loading && tasks.length === 0 && (
          <li>
            <div className="tasks-empty-state">
              <CheckSquare size={28} strokeWidth={1.5} className="tasks-empty-icon" aria-hidden />
              <span>No tasks yet — add one in Tasks</span>
            </div>
          </li>
        )}
      </ul>
      {!loading && total > 0 && (
        <div className="task-count-footer">
          {remaining} task{remaining !== 1 ? "s" : ""} left · {doneCount} done
        </div>
      )}
      <div className="widget-open-hint widget-open-hint--icon">
        <span>Click to open Tasks</span>
        <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
      </div>
    </div>
  );
}
