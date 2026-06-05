/** Productivity module types — extends planner types with list/area/label metadata. */

export type {
  PlannerTask,
  PlannerEvent,
  TaskPriority,
  TaskCategory,
  TaskGroup,
} from "../components/tasks-calendar/types";

export type CalendarViewMode = "day" | "week" | "month" | "agenda";

export type TaskListKey =
  | "inbox"
  | "today"
  | "upcoming"
  | "anytime"
  | "someday"
  | "completed"
  | "project"
  | "area"
  | "label"
  | "filter";

export interface ProductivityProject {
  id: string;
  name: string;
  color: string;
  areaId?: string;
}

export interface ProductivityArea {
  id: string;
  name: string;
  icon: string;
}

export interface ProductivityLabel {
  id: string;
  name: string;
  color: string;
}

export interface FocusBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
}

export interface CalendarFilter {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export type TaskSortKey = "due" | "priority" | "title" | "created";

export interface TaskViewState {
  listKey: TaskListKey;
  projectId?: string;
  areaId?: string;
  labelId?: string;
  search: string;
  sort: TaskSortKey;
  showCompleted: boolean;
  boardMode: boolean;
}
