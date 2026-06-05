import type { PlannerTask, TaskPriority } from "../../components/tasks-calendar/types";
import type { TaskListKey, TaskSortKey } from "../types";
import { getListTitle } from "./TasksTopBar";

const PRIORITY_RANK: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function toPlannerCalView(view: "day" | "week" | "month" | "agenda") {
  if (view === "week") return "workweek" as const;
  return view;
}

export function filterTasksByList(
  tasks: PlannerTask[],
  listKey: TaskListKey,
  _meta?: { projectId?: string; areaId?: string; labelId?: string },
): PlannerTask[] {
  switch (listKey) {
    case "today":
      return tasks.filter((t) => t.group === "today");
    case "upcoming":
      return tasks.filter((t) => t.group === "upcoming");
    case "completed":
      return tasks.filter((t) => t.completed);
    case "inbox":
      return tasks.filter((t) => !t.completed);
    case "anytime":
    case "someday":
    case "project":
    case "area":
    case "label":
    case "filter":
      return tasks;
    default:
      return tasks;
  }
}

export function filterTasksBySearch(tasks: PlannerTask[], needle: string): PlannerTask[] {
  const q = needle.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.projectName?.toLowerCase().includes(q) ?? false),
  );
}

export function sortTasks(tasks: PlannerTask[], sort: TaskSortKey): PlannerTask[] {
  const list = [...tasks];
  if (sort === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }
  if (sort === "priority") {
    list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return list;
  }
  list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return list;
}

export interface TaskSectionGroup {
  id: string;
  title: string;
  tasks: PlannerTask[];
}

export function groupTasksForList(tasks: PlannerTask[], listKey: TaskListKey): TaskSectionGroup[] {
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  if (listKey === "completed") {
    return done.length ? [{ id: "done", title: "Completed", tasks: done }] : [];
  }

  if (listKey === "today" || listKey === "inbox") {
    const today = open.filter((t) => t.group === "today");
    const upcoming = open.filter((t) => t.group === "upcoming");
    const other = open.filter((t) => t.group !== "today" && t.group !== "upcoming");
    const groups: TaskSectionGroup[] = [];
    if (today.length) groups.push({ id: "today", title: "Today", tasks: today });
    if (upcoming.length) groups.push({ id: "upcoming", title: "Upcoming", tasks: upcoming });
    if (other.length) groups.push({ id: "other", title: "Later", tasks: other });
    if (done.length) groups.push({ id: "done", title: "Completed", tasks: done });
    return groups;
  }

  const title = getListTitle(listKey);
  const groups: TaskSectionGroup[] = [];
  if (open.length) groups.push({ id: "open", title, tasks: open });
  if (done.length && listKey !== "upcoming") {
    groups.push({ id: "done", title: "Completed", tasks: done });
  }
  return groups;
}
