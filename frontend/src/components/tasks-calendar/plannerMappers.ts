import {
  endOfWeek,
  endOfWorkWeek,
  fetchRangeForView,
  startOfWeek,
  startOfWorkWeek,
} from "../../lib/calendarDate";
import type { CalendarEvent } from "../calendar/calendarTypes";
import type {
  CalendarRangeView,
  PlannerEvent,
  PlannerTask,
  TaskCategory,
  TaskGroup,
} from "./types";

export interface ApiTask {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  createdAt: string;
  project?: { id: string; name: string } | null;
}

const CATEGORY_NAMES: TaskCategory[] = ["Work", "Personal", "School", "Fitness"];

export function projectToCategory(projectName: string): TaskCategory {
  const exact = CATEGORY_NAMES.find((c) => c.toLowerCase() === projectName.trim().toLowerCase());
  if (exact) return exact;
  const lower = projectName.toLowerCase();
  if (/(work|job|office|cortex)/i.test(lower)) return "Work";
  if (/(school|class|uni|college|homework)/i.test(lower)) return "School";
  if (/(gym|fitness|workout|health)/i.test(lower)) return "Fitness";
  return "Personal";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function taskGroupForApi(task: ApiTask): TaskGroup {
  if (task.status === "DONE") return "completed";
  const today = startOfDay(new Date());
  if (!task.dueDate) return "today";
  const due = startOfDay(new Date(task.dueDate));
  if (due.getTime() <= today.getTime()) return "today";
  return "upcoming";
}

export function plannerGroupForTask(task: Pick<PlannerTask, "dueAt" | "status" | "completed">): TaskGroup {
  if (task.status === "DONE" || task.completed) return "completed";
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(task.dueAt));
  if (due.getTime() <= today.getTime()) return "today";
  return "upcoming";
}

export function mapApiTaskToPlanner(task: ApiTask): PlannerTask {
  const projectName = task.project?.name ?? "Personal";
  return {
    id: task.id,
    title: task.title,
    dueAt: task.dueDate ?? task.createdAt,
    priority: task.priority,
    category: projectToCategory(projectName),
    group: taskGroupForApi(task),
    completed: task.status === "DONE",
    notes: task.description?.trim() || undefined,
    projectId: task.project?.id,
    projectName,
    status: task.status,
  };
}

export function mapPlannerToCalendarEvent(ev: PlannerEvent): CalendarEvent {
  return {
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    allDay: ev.allDay,
    location: ev.location,
    description: ev.description,
    source: ev.source ?? "google",
    calendarName: ev.calendarName,
    color: ev.color,
    providerEventId: ev.providerEventId ?? ev.id,
    calendarId: ev.calendarId,
    accountEmail: ev.accountEmail,
  };
}

export function mapCalendarEventToPlanner(ev: CalendarEvent): PlannerEvent {
  return {
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    allDay: ev.allDay,
    color: ev.color,
    category: undefined,
    source: ev.source,
    providerEventId: ev.providerEventId,
    calendarId: ev.calendarId,
    accountEmail: ev.accountEmail,
    location: ev.location,
    description: ev.description,
    calendarName: ev.calendarName,
  };
}

export function fetchRangeForPlannerView(
  view: CalendarRangeView,
  anchor: Date,
): { start: string; end: string } {
  if (view === "day") {
    const start = startOfDay(anchor);
    const end = new Date(anchor);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (view === "workweek") {
    const start = startOfWorkWeek(anchor);
    const end = endOfWorkWeek(anchor);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (view === "agenda") {
    const start = startOfDay(anchor);
    const end = new Date(anchor);
    end.setDate(end.getDate() + 42);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  return fetchRangeForView("month", anchor);
}
