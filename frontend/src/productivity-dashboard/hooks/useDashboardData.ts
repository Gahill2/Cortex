import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CalendarEvent } from "../../components/calendar/calendarTypes";
import {
  fetchRangeForPlannerView,
  mapApiTaskToPlanner,
  mapCalendarEventToPlanner,
  type ApiTask,
} from "../../components/tasks-calendar/plannerMappers";
import type { PlannerEvent, PlannerTask } from "../../components/tasks-calendar/types";

export interface DashboardMailPreview {
  id: string;
  subject: string;
  from: string;
  unread: boolean;
  snippet?: string;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: T[] }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function unwrapApiBody<T>(axiosData: unknown): T {
  if (axiosData && typeof axiosData === "object" && "ok" in axiosData && "data" in axiosData) {
    return (axiosData as { data: T }).data;
  }
  return axiosData as T;
}

function eventOnDay(ev: PlannerEvent, day: Date): boolean {
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function useDashboardData() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [todayEvents, setTodayEvents] = useState<PlannerEvent[]>([]);
  const [mailMessages, setMailMessages] = useState<DashboardMailPreview[]>([]);
  const [hasMailAccounts, setHasMailAccounts] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [mailLoading, setMailLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTasksLoading(true);
    setEventsLoading(true);
    setMailLoading(true);
    setTasksError(null);
    setEventsError(null);
    setMailError(null);

    const today = new Date();
    const { start, end } = fetchRangeForPlannerView("week", today);

    const [tasksResult, eventsResult, mailResult] = await Promise.allSettled([
      api.get("/tasks"),
      api.get("/calendar/events", { params: { start, end } }),
      (async () => {
        const acc = await api.get<{ data?: { accounts: { id: string }[] } }>("/mail/accounts");
        const accounts = acc.data?.data?.accounts ?? [];
        setHasMailAccounts(accounts.length > 0);
        if (accounts.length === 0) return [];
        const inbox = await api.get<{
          data?: {
            messages: Array<{
              id: string;
              subject: string;
              from: string;
              unread: boolean;
              snippet?: string;
            }>;
          };
        }>("/mail/inbox", { params: { unified: "true", maxResults: 12 } });
        return inbox.data?.data?.messages ?? [];
      })(),
    ]);

    if (tasksResult.status === "fulfilled") {
      const raw = unwrapList<ApiTask>(unwrapApiBody(tasksResult.value.data));
      try {
        setTasks(raw.map(mapApiTaskToPlanner));
      } catch {
        setTasks([]);
        setTasksError("Could not parse tasks.");
      }
    } else {
      setTasks([]);
      setTasksError("Could not load tasks. Sign in and ensure the API is running.");
    }
    setTasksLoading(false);

    if (eventsResult.status === "fulfilled") {
      const payload = unwrapApiBody(eventsResult.value.data);
      const evs = unwrapList<CalendarEvent>(
        payload && typeof payload === "object" && "events" in payload
          ? (payload as { events?: CalendarEvent[] }).events
          : payload,
      );
      try {
        const mapped = evs.map(mapCalendarEventToPlanner);
        setTodayEvents(mapped.filter((ev) => eventOnDay(ev, today)));
      } catch {
        setTodayEvents([]);
        setEventsError("Could not parse calendar events.");
      }
    } else {
      setTodayEvents([]);
      setEventsError("Could not load calendar. Connect Google or Microsoft in Settings.");
    }
    setEventsLoading(false);

    if (mailResult.status === "fulfilled") {
      setMailMessages(
        mailResult.value.map((m) => ({
          id: m.id,
          subject: m.subject,
          from: m.from,
          unread: m.unread,
          snippet: m.snippet,
        })),
      );
    } else {
      setMailMessages([]);
      setMailError("Could not load mail.");
    }
    setMailLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    tasks,
    todayEvents,
    mailMessages,
    hasMailAccounts,
    tasksLoading,
    eventsLoading,
    mailLoading,
    tasksError,
    eventsError,
    mailError,
    refresh: load,
  };
}
