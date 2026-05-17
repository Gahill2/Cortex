import { Router } from "express";
import { google } from "googleapis";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { createOAuth2Client } from "../../features/gmail/gmail-service.js";
import { getGoogleCredentials } from "../../features/gmail/google-token-store.js";
import { getValidMicrosoftToken } from "../../features/microsoft/microsoft-service.js";
import { prisma } from "../../db/prisma.js";

export const cortexCalendarRouter = Router();

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;      // ISO
  end: string;        // ISO
  allDay: boolean;
  location?: string;
  description?: string;
  source: "google" | "microsoft";
  calendarName?: string;
  color?: string;
}

// ── Google Calendar ────────────────────────────────────────────────────────────

async function fetchGoogleEvents(userId: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const creds = await getGoogleCredentials(userId);
  if (!creds?.access_token && !creds?.refresh_token) return [];

  const auth = createOAuth2Client();
  auth.setCredentials(creds);
  const cal = google.calendar({ version: "v3", auth });

  try {
    const listRes = await cal.calendarList.list({ minAccessRole: "reader" });
    const calendars = listRes.data.items ?? [];

    const events: CalendarEvent[] = [];
    for (const calendar of calendars) {
      const calId = calendar.id!;
      const color = calendar.backgroundColor ?? undefined;
      try {
        const evRes = await cal.events.list({
          calendarId: calId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });
        for (const ev of evRes.data.items ?? []) {
          const allDay = Boolean(ev.start?.date && !ev.start.dateTime);
          events.push({
            id: `google_${ev.id}`,
            title: ev.summary ?? "(No title)",
            start: ev.start?.dateTime ?? ev.start?.date ?? "",
            end:   ev.end?.dateTime   ?? ev.end?.date   ?? "",
            allDay,
            location: ev.location ?? undefined,
            description: ev.description ?? undefined,
            source: "google",
            calendarName: calendar.summary ?? undefined,
            color,
          });
        }
      } catch { /* skip inaccessible calendar */ }
    }
    return events;
  } catch {
    return [];
  }
}

// ── Microsoft Calendar ─────────────────────────────────────────────────────────

async function fetchMicrosoftEvents(userId: string, email: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  let token: string;
  try {
    token = await getValidMicrosoftToken(userId, email);
  } catch {
    return [];
  }

  const GRAPH = "https://graph.microsoft.com/v1.0";
  try {
    // Get all calendars first
    const calRes = await fetch(`${GRAPH}/me/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!calRes.ok) return [];
    const calData = (await calRes.json()) as { value: Array<{ id: string; name: string; color: string }> };

    const events: CalendarEvent[] = [];
    for (const cal of calData.value) {
      const url = `${GRAPH}/me/calendars/${cal.id}/calendarView?startDateTime=${timeMin}&endDateTime=${timeMax}&$orderby=start/dateTime&$top=50`;
      const evRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
      });
      if (!evRes.ok) continue;
      const evData = (await evRes.json()) as { value: Array<Record<string, unknown>> };
      for (const ev of evData.value) {
        const start = ev.start as { dateTime: string; timeZone: string };
        const end   = ev.end   as { dateTime: string; timeZone: string };
        const allDay = Boolean((ev as Record<string, unknown>).isAllDay);
        events.push({
          id: `microsoft_${ev.id as string}`,
          title: (ev.subject as string) ?? "(No title)",
          start: start.dateTime,
          end:   end.dateTime,
          allDay,
          location: (ev.location as { displayName?: string })?.displayName ?? undefined,
          description: (ev.bodyPreview as string) ?? undefined,
          source: "microsoft",
          calendarName: cal.name,
          color: undefined,
        });
      }
    }
    return events;
  } catch {
    return [];
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /calendar/events?start=ISO&end=ISO
cortexCalendarRouter.get("/events", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;

  const now = new Date();
  const start = (req.query.start as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end   = (req.query.end   as string) || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  try {
    const [googleEvents, microsoftAccounts] = await Promise.all([
      fetchGoogleEvents(userId, start, end),
      prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
    ]);

    const msEventArrays = await Promise.all(
      microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
    );
    const msEvents = msEventArrays.flat();

    const all = [...googleEvents, ...msEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    sendSuccess(res, { events: all, count: all.length });
  } catch (e) {
    throw new HttpError(500, `Calendar fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});

// Exported helper for AI briefing
export async function fetchCalendarToday(userId: string, start: string, end: string): Promise<Array<{ title: string; start: string }>> {
  const [googleEvents, microsoftAccounts] = await Promise.all([
    fetchGoogleEvents(userId, start, end),
    prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
  ]);
  const msEventArrays = await Promise.all(
    microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
  );
  return [...googleEvents, ...msEventArrays.flat()]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((e) => ({ title: e.title, start: e.start }));
}

// GET /calendar/today  – just today's events (used by AI briefing)
cortexCalendarRouter.get("/today", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  try {
    const [googleEvents, microsoftAccounts] = await Promise.all([
      fetchGoogleEvents(userId, start, end),
      prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
    ]);
    const msEventArrays = await Promise.all(
      microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
    );
    const all = [...googleEvents, ...msEventArrays.flat()].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    sendSuccess(res, { events: all });
  } catch (e) {
    throw new HttpError(500, `Calendar fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});
