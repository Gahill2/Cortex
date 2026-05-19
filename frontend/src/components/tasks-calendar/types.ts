/** Shared types for the Tasks & Calendar command center (mock + future API). */

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type TaskCategory = "Work" | "Personal" | "School" | "Fitness";
export type TaskGroup = "today" | "upcoming" | "completed";

export interface PlannerTask {
  id: string;
  title: string;
  dueAt: string;
  priority: TaskPriority;
  category: TaskCategory;
  group: TaskGroup;
  completed: boolean;
  notes?: string;
}

export interface PlannerEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
  category?: TaskCategory;
}

export type CalendarRangeView = "day" | "week" | "month";

export type CategoryFilter = "All" | TaskCategory;
