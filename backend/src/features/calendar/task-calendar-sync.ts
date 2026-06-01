import type { Task } from "@prisma/client";
import { google } from "googleapis";
import { createOAuth2Client } from "../gmail/gmail-service.js";
import { getGoogleCredentials } from "../gmail/google-token-store.js";

export type CalendarSyncResult =
  | { ok: true; googleEventId: string; googleCalendarId: string }
  | { ok: false; error: string; needsReconnect?: boolean };

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|401|insufficient|scope|permission|consent|forbidden/i.test(msg);
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eventTimes(task: Pick<Task, "dueDate" | "planStart" | "planEnd">, timeZone: string) {
  const due = task.dueDate ?? task.planStart;
  if (!due) return null;

  if (task.planStart && task.planEnd) {
    return {
      allDay: false,
      start: { dateTime: task.planStart.toISOString(), timeZone },
      end: { dateTime: task.planEnd.toISOString(), timeZone },
    };
  }

  const day = formatDateOnly(due);
  const next = new Date(due);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    allDay: true,
    start: { date: day },
    end: { date: formatDateOnly(next) },
  };
}

async function googleCalendarClient(userId: string) {
  const creds = await getGoogleCredentials(userId);
  if (!creds?.access_token && !creds?.refresh_token) return null;
  const auth = createOAuth2Client();
  auth.setCredentials(creds);
  return google.calendar({ version: "v3", auth });
}

async function primaryCalendarId(cal: ReturnType<typeof google.calendar>): Promise<string | null> {
  const list = await cal.calendarList.list({ minAccessRole: "writer" });
  const primary = list.data.items?.find((c) => c.primary) ?? list.data.items?.[0];
  return primary?.id ?? null;
}

/** Create or update a Google Calendar event for a task with a due/schedule date. */
export async function syncTaskToGoogleCalendar(
  userId: string,
  task: Task,
  timeZone = "UTC"
): Promise<CalendarSyncResult> {
  if (!task.syncToCalendar || !task.dueDate) {
    return { ok: false, error: "calendar_sync_skipped" };
  }

  const cal = await googleCalendarClient(userId);
  if (!cal) {
    return { ok: false, error: "Google Calendar is not connected", needsReconnect: true };
  }

  const times = eventTimes(task, timeZone);
  if (!times) {
    return { ok: false, error: "Task has no schedule date" };
  }

  const calendarId = task.googleCalendarId ?? (await primaryCalendarId(cal));
  if (!calendarId) {
    return { ok: false, error: "No writable Google calendar found" };
  }

  const statusLabel =
    task.status === "DONE"
      ? "Done"
      : task.status === "IN_PROGRESS"
        ? "In progress"
        : "To do";

  const requestBody = {
    summary: task.title,
    description: [
      task.description?.trim(),
      `Status: ${statusLabel} (${task.progressPercent}%)`,
      "— Created from Cortex Tasks",
    ]
      .filter(Boolean)
      .join("\n\n"),
    ...times,
  };

  try {
    if (task.googleEventId) {
      await cal.events.patch({
        calendarId,
        eventId: task.googleEventId,
        requestBody,
      });
      return { ok: true, googleEventId: task.googleEventId, googleCalendarId: calendarId };
    }

    const created = await cal.events.insert({
      calendarId,
      requestBody,
    });
    const eventId = created.data.id;
    if (!eventId) {
      return { ok: false, error: "Google did not return an event id" };
    }
    return { ok: true, googleEventId: eventId, googleCalendarId: calendarId };
  } catch (err) {
    if (isAuthError(err)) {
      return {
        ok: false,
        error: "Reconnect Gmail in Mail to allow calendar write access",
        needsReconnect: true,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 200) };
  }
}

/** Remove linked Google event when task is unscheduled or sync disabled. */
export async function removeTaskFromGoogleCalendar(userId: string, task: Task): Promise<void> {
  if (!task.googleEventId || !task.googleCalendarId) return;
  const cal = await googleCalendarClient(userId);
  if (!cal) return;
  try {
    await cal.events.delete({
      calendarId: task.googleCalendarId,
      eventId: task.googleEventId,
    });
  } catch {
    /* event may already be deleted */
  }
}

/** Map progress slider to status for consistent planning views. */
export function statusForProgress(progressPercent: number): "TODO" | "IN_PROGRESS" | "DONE" {
  if (progressPercent >= 100) return "DONE";
  if (progressPercent > 0) return "IN_PROGRESS";
  return "TODO";
}

export function progressForStatus(status: string): number {
  if (status === "DONE") return 100;
  if (status === "IN_PROGRESS") return 50;
  return 0;
}
