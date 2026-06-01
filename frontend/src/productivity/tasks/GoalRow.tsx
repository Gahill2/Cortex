import { Check, Flag } from "lucide-react";
import type { CortexGoal } from "../../lib/uiCustomization";
import { goalProgress } from "../../lib/uiCustomization";

interface Props {
  goal: CortexGoal;
  selected?: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function GoalRow({ goal, selected, onSelect, onToggle }: Props) {
  const pct = goalProgress(goal);

  return (
    <article
      className={`pd-task-row pd-task-row--goal${selected ? " pd-task-row--selected" : ""}${goal.done ? " pd-task-row--done" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      role="button"
      tabIndex={0}
    >
      <span className="pd-task-row__check">
        <button
          type="button"
          className={`pd-task-row__check-btn${goal.done ? " pd-task-row__check-btn--done" : ""}`}
          aria-label={goal.done ? "Mark goal incomplete" : "Complete goal"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {goal.done ? <Check size={14} strokeWidth={2.5} /> : null}
        </button>
      </span>
      <div className="pd-task-row__body">
        <p className="pd-task-row__title">
          <Flag size={13} className="pd-task-row__goal-icon" aria-hidden />
          {goal.text}
        </p>
        {!goal.done ? (
          <div className="pd-task-row__progress" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        <div className="pd-task-row__meta">
          <span className="pd-task-row__progress-pill">{pct}%</span>
          <span className="pd-task-row__kind-pill">Goal</span>
          {goal.targetDate ? (
            <span className="pd-task-row__cat">
              Target{" "}
              {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          ) : (
            <span className="pd-task-row__cat">No due date</span>
          )}
        </div>
      </div>
    </article>
  );
}
