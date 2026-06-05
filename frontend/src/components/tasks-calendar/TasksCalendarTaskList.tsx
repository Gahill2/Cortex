import { TccIconCheck } from "./TccIcons";
import type { PlannerTask, TaskGroup } from "./types";
import { TaskContextMenu } from "./TaskContextMenu";

const GROUP_LABELS: Record<TaskGroup, string> = {
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

const PRIORITY_CLASS: Record<PlannerTask["priority"], string> = {
  HIGH: "tcc-priority--high",
  MEDIUM: "tcc-priority--medium",
  LOW: "tcc-priority--low",
};

const CATEGORY_CLASS: Record<PlannerTask["category"], string> = {
  Work: "tcc-cat--work",
  Personal: "tcc-cat--personal",
  School: "tcc-cat--school",
  Fitness: "tcc-cat--fitness",
};

function fmtDue(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Props {
  tasks: PlannerTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: PlannerTask) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onUpdateStatus?: (id: string, status: NonNullable<PlannerTask["status"]>) => void;
}

export function TasksCalendarTaskList({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onDeleteTask,
  onUpdateStatus,
}: Props) {
  const groups: TaskGroup[] = ["today", "upcoming", "completed"];

  return (
    <section className="tcc-card tcc-tasks-card" aria-label="Tasks">
      <div className="tcc-card-head">
        <h2 className="tcc-card-title">Tasks</h2>
        <span className="tcc-card-meta">{tasks.filter((t) => !t.completed).length} open</span>
      </div>
      <div className="tcc-task-groups">
        {groups.map((group) => {
          const items = tasks.filter((t) => t.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="tcc-task-group">
              <h3 className="tcc-task-group-title">{GROUP_LABELS[group]}</h3>
              <ul className="tcc-task-list">
                {items.map((task) => (
                  <li key={task.id}>
                    <TaskContextMenu
                      task={task}
                      onUpdateStatus={onUpdateStatus ?? (() => {})}
                      onDelete={onDeleteTask ?? (() => {})}
                    >
                      <article
                        className={`tcc-task-card${selectedTaskId === task.id ? " tcc-task-card--selected" : ""}${task.completed ? " tcc-task-card--done" : ""}`}
                        onClick={() => onSelectTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSelectTask(task);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <button
                          type="button"
                          className={`kanban-check${task.completed ? " kanban-check--done" : ""}`}
                          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(task.id);
                          }}
                        >
                          {task.completed ? <TccIconCheck /> : null}
                        </button>
                        <div className="tcc-task-card-body">
                          <p className="tcc-task-title">{task.title}</p>
                          <p className="tcc-task-due">{fmtDue(task.dueAt)}</p>
                          <div className="tcc-task-badges">
                            <span className={`tcc-badge tcc-priority ${PRIORITY_CLASS[task.priority]}`}>
                              {task.priority === "HIGH" ? "High" : task.priority === "MEDIUM" ? "Medium" : "Low"}
                            </span>
                            <span className={`tcc-badge tcc-category ${CATEGORY_CLASS[task.category]}`}>
                              {task.category}
                            </span>
                          </div>
                        </div>
                      </article>
                    </TaskContextMenu>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
