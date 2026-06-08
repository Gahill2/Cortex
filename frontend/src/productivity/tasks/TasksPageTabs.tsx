import { CheckSquare, Flag } from "lucide-react";

export type TasksPageTab = "tasks" | "goals";

interface Props {
  tab: TasksPageTab;
  taskCount: number;
  goalCount: number;
  onChange: (tab: TasksPageTab) => void;
}

export function TasksPageTabs({ tab, taskCount, goalCount, onChange }: Props) {
  return (
    <div className="pd-page-tabs" role="tablist" aria-label="Tasks or goals">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "tasks"}
        className={`pd-page-tabs__btn${tab === "tasks" ? " pd-page-tabs__btn--active" : ""}`}
        onClick={() => onChange("tasks")}
      >
        <CheckSquare size={16} aria-hidden />
        Tasks
        {taskCount > 0 ? <span className="pd-page-tabs__badge">{taskCount}</span> : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "goals"}
        className={`pd-page-tabs__btn${tab === "goals" ? " pd-page-tabs__btn--active" : ""}`}
        onClick={() => onChange("goals")}
      >
        <Flag size={16} aria-hidden />
        Goals
        {goalCount > 0 ? <span className="pd-page-tabs__badge">{goalCount}</span> : null}
      </button>
    </div>
  );
}
