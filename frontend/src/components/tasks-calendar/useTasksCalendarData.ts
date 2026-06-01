import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CalendarEvent } from "../calendar/calendarTypes";
import type { CalendarRangeView, PlannerEvent, PlannerTask } from "./types";
import { patchCalendarEvent } from "../calendar/calendarApi";
import {
  fetchRangeForPlannerView,
  mapApiTaskToPlanner,
  mapCalendarEventToPlanner,
  mapPlannerToCalendarEvent,
  plannerGroupForTask,
  type ApiTask,
} from "./plannerMappers";
import type { TaskPriority } from "./types";

interface Project {
  id: string;
  name: string;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: T[] }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export function useTasksCalendarData(viewDate: Date, calView: CalendarRangeView) {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [calendarWarnings, setCalendarWarnings] = useState<string[]>([]);
  const [hasCalendarAccount, setHasCalendarAccount] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const r = await api.get("/projects");
      const list = unwrapList<Project>(r.data?.data ?? r.data);
      setProjects(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const [tr, pr] = await Promise.all([api.get("/tasks"), api.get("/projects")]);
      const raw = unwrapList<ApiTask>(tr.data?.data ?? tr.data);
      const projs = unwrapList<Project>(pr.data?.data ?? pr.data);
      setProjects(projs);
      setTasks(raw.map(mapApiTaskToPlanner));
    } catch {
      setTasksError("Could not load tasks. Check that you are signed in and the API is running.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    setCalendarWarnings([]);
    const { start, end } = fetchRangeForPlannerView(calView, viewDate);
    try {
      const r = await api.get("/calendar/events", { params: { start, end } });
      const payload = r.data?.data ?? r.data;
      const evs = unwrapList<CalendarEvent>(payload?.events ?? payload);
      const warnings: string[] = Array.isArray(payload?.warnings) ? payload.warnings : [];
      setEvents(evs.map(mapCalendarEventToPlanner));
      setCalendarWarnings(warnings);
    } catch {
      setEventsError("Could not load calendar events.");
    } finally {
      setEventsLoading(false);
    }
  }, [calView, viewDate]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<{ data?: { accounts: { provider: string }[] } }>("/mail/accounts");
        const accounts = r.data?.data?.accounts ?? [];
        setHasCalendarAccount(
          accounts.some((a) => a.provider === "gmail" || a.provider === "microsoft"),
        );
      } catch {
        setHasCalendarAccount(null);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadTasks(), loadEvents()]);
  }, [loadTasks, loadEvents]);

  const toggleTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const nextStatus = task.completed ? "TODO" : "DONE";
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const completed = nextStatus === "DONE";
          return {
            ...t,
            completed,
            status: nextStatus,
            group: completed ? "completed" : t.group === "completed" ? "today" : t.group,
          };
        }),
      );
      try {
        await api.patch(`/tasks/${id}`, { status: nextStatus });
      } catch {
        await loadTasks();
      }
    },
    [tasks, loadTasks],
  );

  const resolveProjectId = useCallback(async () => {
    let projectId = projects[0]?.id;
    if (!projectId) {
      const list = await loadProjects();
      projectId = list[0]?.id;
    }
    return projectId ?? null;
  }, [projects, loadProjects]);

  const createTaskFields = useCallback(
    async (fields: {
      title: string;
      status?: ApiTask["status"];
      priority?: TaskPriority;
      dueDate?: string | null;
      description?: string | null;
    }) => {
      const projectId = await resolveProjectId();
      if (!projectId) {
        setTasksError("Add a project before creating tasks.");
        return null;
      }
      setBusy(true);
      setTasksError(null);
      try {
        const r = await api.post("/tasks", {
          title: fields.title,
          projectId,
          priority: fields.priority ?? "MEDIUM",
          status: fields.status ?? "TODO",
          dueDate: fields.dueDate ? new Date(fields.dueDate).toISOString() : null,
          description: fields.description || undefined,
          progressPercent: 0,
        });
        const created = (r.data?.data ?? r.data) as ApiTask;
        const planner = mapApiTaskToPlanner(created);
        setTasks((prev) => [planner, ...prev]);
        return planner.id;
      } catch {
        setTasksError("Could not create task.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [resolveProjectId],
  );

  const createTask = useCallback(async () => {
    return createTaskFields({ title: "New task" });
  }, [createTaskFields]);

  const createOpenTask = useCallback(
    async (title: string, description?: string | null) => {
      return createTaskFields({
        title: title.trim(),
        dueDate: null,
        description: description ?? null,
      });
    },
    [createTaskFields],
  );

  const quickAddTask = useCallback(
    async (status: ApiTask["status"], title: string) => {
      if (!title.trim()) return null;
      return createTaskFields({ title: title.trim(), status });
    },
    [createTaskFields],
  );

  const createTaskFromNl = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      let title = trimmed;
      let priority: TaskPriority = "MEDIUM";
      let dueDate: string | null = null;
      let description: string | null = null;
      try {
        const r = await api.post("/ai/tasks/parse", { text: trimmed });
        const d = (r.data?.data ?? r.data) as {
          title?: string;
          priority?: TaskPriority;
          dueDate?: string | null;
          description?: string | null;
        };
        title = d.title ?? trimmed;
        if (d.priority) priority = d.priority;
        dueDate = d.dueDate ?? null;
        description = d.description ?? null;
      } catch {
        /* create with raw title */
      }
      return createTaskFields({ title, priority, dueDate, description, status: "TODO" });
    },
    [createTaskFields],
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: ApiTask["status"]) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const completed = status === "DONE";
          const next = { ...t, status, completed };
          return { ...next, group: plannerGroupForTask(next) };
        }),
      );
      try {
        await api.patch(`/tasks/${id}`, { status });
      } catch {
        await loadTasks();
      }
    },
    [loadTasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await api.delete(`/tasks/${id}`);
      } catch {
        await loadTasks();
      }
    },
    [loadTasks],
  );

  const updateTask = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        description?: string | null;
        status?: ApiTask["status"];
        priority?: TaskPriority;
        progressPercent?: number;
        dueDate?: string | null;
        planStart?: string | null;
        planEnd?: string | null;
        syncToCalendar?: boolean;
        projectId?: string;
      },
    ): Promise<{ calendarError?: string } | void> => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const hasDue = patch.dueDate !== undefined ? Boolean(patch.dueDate) : t.hasDueDate;
          const next = {
            ...t,
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined ? { notes: patch.description?.trim() || undefined } : {}),
            ...(patch.status !== undefined
              ? {
                  status: patch.status,
                  completed: patch.status === "DONE",
                }
              : {}),
            ...(patch.progressPercent !== undefined ? { progressPercent: patch.progressPercent } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.dueDate !== undefined
              ? { dueAt: patch.dueDate ?? t.dueAt, hasDueDate: Boolean(patch.dueDate) }
              : {}),
            ...(patch.planStart !== undefined ? { planStart: patch.planStart } : {}),
            ...(patch.planEnd !== undefined ? { planEnd: patch.planEnd } : {}),
            ...(patch.syncToCalendar !== undefined ? { syncToCalendar: patch.syncToCalendar } : {}),
            ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
            hasDueDate: patch.dueDate !== undefined ? Boolean(patch.dueDate) : hasDue,
          };
          return { ...next, group: plannerGroupForTask(next) };
        }),
      );
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const r = await api.patch(`/tasks/${id}`, {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.progressPercent !== undefined ? { progressPercent: patch.progressPercent } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.planStart !== undefined ? { planStart: patch.planStart } : {}),
          ...(patch.planEnd !== undefined ? { planEnd: patch.planEnd } : {}),
          ...(patch.syncToCalendar !== undefined ? { syncToCalendar: patch.syncToCalendar } : {}),
          ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
        }, { headers: { "X-Timezone": tz } });
        const body = (r.data?.data ?? r.data) as ApiTask & {
          calendarSync?: { ok: boolean; error?: string; needsReconnect?: boolean };
        };
        if (body?.id) {
          setTasks((prev) =>
            prev.map((t) => (t.id === id ? mapApiTaskToPlanner(body) : t)),
          );
        } else {
          await loadTasks();
        }
        const sync = body?.calendarSync;
        if (sync && !sync.ok && sync.error && sync.error !== "calendar_sync_skipped") {
          return { calendarError: sync.error };
        }
      } catch {
        await loadTasks();
      }
    },
    [loadTasks],
  );

  const createProject = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      try {
        const r = await api.post("/projects", { name: trimmed });
        const body = (r.data?.data ?? r.data) as { id: string; name: string };
        if (body?.id) {
          setProjects((prev) => [...prev, { id: body.id, name: body.name }]);
          return body.id;
        }
      } catch {
        setTasksError("Could not create project.");
      }
      return null;
    },
    [],
  );

  const rescheduleEvent = useCallback(
    async (ev: PlannerEvent, start: Date, end: Date) => {
      setCalendarSaving(true);
      const prevStart = ev.start;
      const prevEnd = ev.end;
      const nextStart = start.toISOString();
      const nextEnd = end.toISOString();
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, start: nextStart, end: nextEnd } : e)),
      );
      try {
        await patchCalendarEvent(mapPlannerToCalendarEvent(ev), nextStart, nextEnd, ev.allDay);
      } catch {
        setEvents((prev) =>
          prev.map((e) => (e.id === ev.id ? { ...e, start: prevStart, end: prevEnd } : e)),
        );
        setEventsError("Could not save calendar change. Try again.");
      } finally {
        setCalendarSaving(false);
      }
    },
    [],
  );

  const loading = tasksLoading || eventsLoading;

  return {
    tasks,
    setTasks,
    events,
    projects,
    tasksLoading,
    eventsLoading,
    loading,
    busy,
    calendarSaving,
    tasksError,
    eventsError,
    calendarWarnings,
    hasCalendarAccount,
    refresh,
    toggleTask,
    createTask,
    createOpenTask,
    quickAddTask,
    createTaskFromNl,
    updateTaskStatus,
    updateTask,
    deleteTask,
    createProject,
    rescheduleEvent,
    loadTasks,
  };
}
