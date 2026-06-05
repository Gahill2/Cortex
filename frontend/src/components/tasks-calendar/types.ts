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
  /** Cortex API fields (for PATCH). */
  projectId?: string;
  projectName?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
}

export interface PlannerEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
  category?: TaskCategory;
  /** Provider metadata for calendar PATCH. */
  source?: "google" | "microsoft";
  providerEventId?: string;
  calendarId?: string;
  accountEmail?: string;
  location?: string;
  description?: string;
  calendarName?: string;
}

/** Teams-style calendar range modes */
export type CalendarRangeView = "workweek" | "week" | "day" | "month" | "agenda";

export type CategoryFilter = "All" | TaskCategory;
