import type { WidgetRenderProps } from "../types";
import type { TaskPriority } from "../../components/tasks-calendar/types";
import { PdBadge } from "../../components/ui/PdBadge";

export function taskPriorityUi(priority: TaskPriority): "high" | "medium" | "low" {
  if (priority === "HIGH") return "high";
  if (priority === "MEDIUM") return "medium";
  return "low";
}

export function useDensity(props: WidgetRenderProps) {
  const density = props.settings.density ?? "default";
  return { compact: density === "compact", expanded: density === "expanded" };
}

export function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  const tone = priority === "high" ? "danger" : priority === "medium" ? "warning" : "neutral";
  return <span className={`pd-priority pd-priority--${tone}`} aria-hidden />;
}

export function TaskRow({
  title,
  done,
  priority,
  due,
  project,
  onToggle,
}: {
  title: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
  due?: string;
  project?: string;
  onToggle?: () => void;
}) {
  return (
    <label className={`pd-task-row${done ? " pd-task-row--done" : ""}`}>
      <span className="pd-task-row__check">
        <input type="checkbox" checked={done} onChange={onToggle} />
      </span>
      {priority ? <PriorityDot priority={priority} /> : null}
      <span className="pd-task-row__title">{title}</span>
      <span className="pd-task-row__chips">
        {due ? <PdBadge tone="neutral">{due}</PdBadge> : null}
        {project ? <span className="pd-task-row__meta">{project}</span> : null}
      </span>
    </label>
  );
}
