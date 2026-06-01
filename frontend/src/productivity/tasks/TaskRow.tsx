import { Check } from "lucide-react";
import type { PlannerTask } from "../../components/tasks-calendar/types";
import { DateChip } from "../shared/DateChip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { ProjectPill } from "../shared/ProjectPill";

interface Props {
  task: PlannerTask;
  selected?: boolean;
  completing?: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function TaskRow({ task, selected, completing, onSelect, onToggle }: Props) {
  const overdue =
    task.hasDueDate && !task.completed && new Date(task.dueAt).getTime() < Date.now();

  return (
    <article
      className={`pd-task-row${selected ? " pd-task-row--selected" : ""}${task.completed ? " pd-task-row--done" : ""}${completing ? " pd-task-row--completing" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      role="button"
      tabIndex={0}
    >
      <span className="pd-task-row__check">
        <button
          type="button"
          className={`pd-task-row__check-btn${task.completed ? " pd-task-row__check-btn--done" : ""}`}
          aria-label={task.completed ? "Mark incomplete" : "Complete task"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {task.completed ? <Check size={14} strokeWidth={2.5} /> : null}
        </button>
      </span>
      <div className="pd-task-row__body">
        <p className="pd-task-row__title">{task.title}</p>
        {!task.completed && (task.progressPercent ?? 0) > 0 ? (
          <div className="pd-task-row__progress" aria-hidden>
            <span style={{ width: `${task.progressPercent}%` }} />
          </div>
        ) : null}
        <div className="pd-task-row__meta">
          {task.hasDueDate ? <DateChip date={task.dueAt} overdue={overdue} compact /> : null}
          {(task.progressPercent ?? 0) > 0 && !task.completed ? (
            <span className="pd-task-row__progress-pill">{task.progressPercent}%</span>
          ) : null}
          {task.projectName ? <ProjectPill name={task.projectName} compact /> : null}
          <PriorityBadge priority={task.priority} compact />
          <span className="pd-task-row__cat">{task.category}</span>
        </div>
      </div>
    </article>
  );
}
