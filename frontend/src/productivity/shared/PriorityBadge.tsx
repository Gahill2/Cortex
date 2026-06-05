import type { TaskPriority } from "../types";

const LABELS: Record<TaskPriority, string> = {
  HIGH: "High",
  MEDIUM: "Med",
  LOW: "Low",
};

interface Props {
  priority: TaskPriority;
  compact?: boolean;
}

export function PriorityBadge({ priority, compact }: Props) {
  return (
    <span className={`pd-priority pd-priority--${priority.toLowerCase()}${compact ? " pd-priority--compact" : ""}`}>
      {LABELS[priority]}
    </span>
  );
}
