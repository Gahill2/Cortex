import type {
  CalendarFilter,
  FocusBlock,
  ProductivityArea,
  ProductivityLabel,
  ProductivityProject,
} from "./types";
import type { PlannerEvent, PlannerTask } from "../components/tasks-calendar/types";
import {
  createMockEvents,
  createMockTasks,
} from "../components/tasks-calendar/mockData";

export const MOCK_AREAS: ProductivityArea[] = [
  { id: "work", name: "Work", icon: "briefcase" },
  { id: "personal", name: "Personal", icon: "home" },
  { id: "school", name: "School", icon: "graduation-cap" },
  { id: "health", name: "Health", icon: "heart" },
];

export const MOCK_PROJECTS: ProductivityProject[] = [
  { id: "p-cortex", name: "Cortex", color: "#5b8dff", areaId: "work" },
  { id: "p-intern", name: "Internship", color: "#a78bfa", areaId: "school" },
  { id: "p-home", name: "Home", color: "#3be8ad", areaId: "personal" },
  { id: "p-fitness", name: "Fitness", color: "#f59e0b", areaId: "health" },
];

export const MOCK_LABELS: ProductivityLabel[] = [
  { id: "l-deep", name: "Deep work", color: "#5b8dff" },
  { id: "l-errand", name: "Errand", color: "#f59e0b" },
  { id: "l-waiting", name: "Waiting", color: "#94a3b8" },
  { id: "l-urgent", name: "Urgent", color: "#ef4444" },
];

export const MOCK_CALENDAR_FILTERS: CalendarFilter[] = [
  { id: "work", label: "Work", color: "#5b8dff", enabled: true },
  { id: "personal", label: "Personal", color: "#3be8ad", enabled: true },
  { id: "school", label: "School", color: "#a78bfa", enabled: true },
  { id: "fitness", label: "Fitness", color: "#f59e0b", enabled: true },
];

function atToday(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const MOCK_FOCUS_BLOCKS: FocusBlock[] = [
  {
    id: "fb-1",
    title: "Morning deep work",
    start: atToday(9, 0),
    end: atToday(11, 30),
    category: "Work",
  },
  {
    id: "fb-2",
    title: "Admin block",
    start: atToday(14, 0),
    end: atToday(15, 0),
    category: "Work",
  },
];

/** Replace with API data — isolated for easy swap. */
export function getMockTasks(): PlannerTask[] {
  return createMockTasks();
}

export function getMockEvents(): PlannerEvent[] {
  return createMockEvents();
}

export const CATEGORY_COLORS: Record<string, string> = {
  Work: "#5b8dff",
  Personal: "#3be8ad",
  School: "#a78bfa",
  Fitness: "#f59e0b",
};
