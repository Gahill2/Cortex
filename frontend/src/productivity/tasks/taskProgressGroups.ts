import type { CortexGoal } from "../../lib/uiCustomization";
import { goalProgress } from "../../lib/uiCustomization";
import type { PlannerTask } from "../../components/tasks-calendar/types";
import type { TaskListKey } from "../types";

export type ProgressBucketId =
  | "not-started"
  | "started"
  | "quarter"
  | "half"
  | "almost"
  | "done";

export const PROGRESS_SECTIONS: { id: ProgressBucketId; title: string; hint: string }[] = [
  { id: "not-started", title: "Not started", hint: "0%" },
  { id: "started", title: "Getting started", hint: "1–24%" },
  { id: "quarter", title: "Early progress", hint: "25–49%" },
  { id: "half", title: "Halfway", hint: "50–74%" },
  { id: "almost", title: "Almost there", hint: "75–99%" },
  { id: "done", title: "Complete", hint: "100%" },
];

export type PlanItem =
  | { kind: "task"; task: PlannerTask }
  | { kind: "goal"; goal: CortexGoal };

export function taskProgressPercent(task: PlannerTask): number {
  if (task.completed || task.status === "DONE") return 100;
  return task.progressPercent ?? 0;
}

export function progressBucket(percent: number, completed: boolean): ProgressBucketId {
  if (completed || percent >= 100) return "done";
  if (percent <= 0) return "not-started";
  if (percent < 25) return "started";
  if (percent < 50) return "quarter";
  if (percent < 75) return "half";
  return "almost";
}

export function filterPlanItems(
  tasks: PlannerTask[],
  goals: CortexGoal[],
  listKey: TaskListKey,
  meta?: { projectId?: string },
): PlanItem[] {
  const items: PlanItem[] = [
    ...tasks.map((task) => ({ kind: "task" as const, task })),
    ...goals.map((goal) => ({ kind: "goal" as const, goal })),
  ];

  switch (listKey) {
    case "completed":
      return items.filter((i) =>
        i.kind === "task" ? i.task.completed : i.goal.done,
      );
    case "anytime":
    case "inbox":
      return items.filter((i) => {
        if (i.kind === "goal") return !i.goal.done;
        return !i.task.completed && !i.task.hasDueDate;
      });
    case "upcoming":
      return items.filter((i) => i.kind === "task" && i.task.hasDueDate && !i.task.completed);
    case "today":
      return items.filter((i) => i.kind === "task" && i.task.group === "today");
    case "project":
      if (meta?.projectId) {
        return items.filter((i) => i.kind === "task" && i.task.projectId === meta.projectId);
      }
      return items.filter((i) => i.kind === "task");
    case "all":
    default:
      return items.filter((i) => (i.kind === "task" ? !i.task.completed : !i.goal.done));
  }
}

export interface ProgressSection {
  id: ProgressBucketId;
  title: string;
  hint: string;
  items: PlanItem[];
}

export function groupPlanItemsByProgress(items: PlanItem[], includeDone = true): ProgressSection[] {
  const buckets = new Map<ProgressBucketId, PlanItem[]>();
  for (const section of PROGRESS_SECTIONS) {
    buckets.set(section.id, []);
  }

  for (const item of items) {
    const pct =
      item.kind === "task" ? taskProgressPercent(item.task) : goalProgress(item.goal);
    const done = item.kind === "task" ? item.task.completed : item.goal.done;
    const id = progressBucket(pct, done);
    buckets.get(id)?.push(item);
  }

  return PROGRESS_SECTIONS.filter((s) => includeDone || s.id !== "done")
    .map((s) => ({
      ...s,
      items: buckets.get(s.id) ?? [],
    }))
    .filter((s) => s.items.length > 0);
}

/** Parse optional manual % from notes, e.g. "progress: 42" or "42%" at start of a line. */
export function parseProgressFromNotes(notes: string): number | null {
  const m =
    notes.match(/(?:^|\n)\s*progress\s*:\s*(\d{1,3})\s*%?/i) ??
    notes.match(/(?:^|\n)\s*(\d{1,3})\s*%\s*(?:done|complete)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}
