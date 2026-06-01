import type { PlannerEvent, PlannerTask } from "./types";

function atToday(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysFromToday(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Dev-only fixtures — production hub uses useTasksCalendarData + /calendar/events. */
export function createMockEvents(): PlannerEvent[] {
  return [
    {
      id: "ev-work",
      title: "Work",
      start: atToday(8, 0),
      end: atToday(12, 0),
      allDay: false,
      color: "#5b8dff",
      category: "Work",
    },
    {
      id: "ev-lunch",
      title: "Lunch",
      start: atToday(12, 0),
      end: atToday(13, 0),
      allDay: false,
      color: "#22c55e",
      category: "Personal",
    },
    {
      id: "ev-gym",
      title: "Gym",
      start: atToday(17, 30),
      end: atToday(18, 30),
      allDay: false,
      color: "#f59e0b",
      category: "Fitness",
    },
    {
      id: "ev-project",
      title: "Personal Project",
      start: atToday(19, 0),
      end: atToday(21, 0),
      allDay: false,
      color: "#a78bfa",
      category: "Personal",
    },
    {
      id: "ev-sync",
      title: "Team sync",
      start: daysFromToday(1, 10, 0),
      end: daysFromToday(1, 10, 45),
      allDay: false,
      color: "#5b8dff",
      category: "Work",
    },
  ];
}

/** Dev-only fixtures — production hub uses useTasksCalendarData + /tasks. */
export function createMockTasks(): PlannerTask[] {
  return [
    {
      id: "t1",
      title: "Finish Cortex MCP module",
      dueAt: atToday(18, 0),
      hasDueDate: true,
      priority: "HIGH",
      category: "Work",
      group: "today",
      completed: false,
      notes: "Wire InsForge tools and document env vars.",
    },
    {
      id: "t2",
      title: "Review internship notes",
      dueAt: atToday(20, 0),
      hasDueDate: true,
      priority: "MEDIUM",
      category: "School",
      group: "today",
      completed: false,
    },
    {
      id: "t3",
      title: "Workout",
      dueAt: atToday(17, 30),
      hasDueDate: true,
      priority: "MEDIUM",
      category: "Fitness",
      group: "today",
      completed: false,
    },
    {
      id: "t4",
      title: "Clean inbox",
      dueAt: daysFromToday(0, 16, 0),
      hasDueDate: true,
      priority: "LOW",
      category: "Work",
      group: "today",
      completed: true,
    },
    {
      id: "t5",
      title: "Plan tomorrow",
      dueAt: daysFromToday(1, 9, 0),
      hasDueDate: true,
      priority: "LOW",
      category: "Personal",
      group: "upcoming",
      completed: false,
    },
    {
      id: "t6",
      title: "Read chapter 4",
      dueAt: daysFromToday(2, 14, 0),
      hasDueDate: true,
      priority: "MEDIUM",
      category: "School",
      group: "upcoming",
      completed: false,
    },
    {
      id: "t7",
      title: "Submit timesheet",
      dueAt: daysFromToday(-1, 17, 0),
      hasDueDate: true,
      priority: "HIGH",
      category: "Work",
      group: "completed",
      completed: true,
    },
  ];
}
