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

type FetchResult = { events: CalendarEvent[]; warnings: string[] };

function calendarScopeHint(source: "google" | "microsoft"): string {
  if (source === "google") {
    return "Reconnect Gmail in Mail to grant Google Calendar access (calendar permission was added).";
  }
  return "Reconnect Microsoft in Mail to grant calendar access (Calendars.Read was added).";
}

function isScopeOrAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|401|insufficient|scope|permission|consent|forbidden/i.test(msg);
}

// ── Google Calendar ────────────────────────────────────────────────────────────

async function fetchGoogleEvents(userId: string, timeMin: string, timeMax: string): Promise<FetchResult> {
  const warnings: string[] = [];
  const creds = await getGoogleCredentials(userId);
  if (!creds?.access_token && !creds?.refresh_token) {
    return { events: [], warnings };
  }

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
      } catch (err) {
        console.warn("[calendar] google calendar events skipped:", calId, err);
      }
    }
    return { events, warnings };
  } catch (err) {
    console.error("[calendar] google fetch failed:", err);
    if (isScopeOrAuthError(err)) {
      warnings.push(calendarScopeHint("google"));
    } else {
      warnings.push("Could not load Google Calendar. Try reconnecting Gmail in Mail.");
    }
    return { events: [], warnings };
  }
}

// ── Microsoft Calendar ─────────────────────────────────────────────────────────

async function fetchMicrosoftEvents(userId: string, email: string, timeMin: string, timeMax: string): Promise<FetchResult> {
  const warnings: string[] = [];
  let token: string;
  try {
    token = await getValidMicrosoftToken(userId, email);
  } catch (err) {
    console.warn("[calendar] microsoft token for", email, err);
    warnings.push(`Microsoft (${email}): sign in again from Mail.`);
    return { events: [], warnings };
  }

  const GRAPH = "https://graph.microsoft.com/v1.0";
  try {
    const calRes = await fetch(`${GRAPH}/me/calendars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!calRes.ok) {
      const body = await calRes.text().catch(() => "");
      console.error("[calendar] microsoft calendars:", calRes.status, body);
      if (calRes.status === 403 || calRes.status === 401) {
        warnings.push(calendarScopeHint("microsoft"));
      } else {
        warnings.push(`Microsoft (${email}): could not list calendars.`);
      }
      return { events: [], warnings };
    }
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
    return { events, warnings };
  } catch (err) {
    console.error("[calendar] microsoft fetch failed:", err);
    if (isScopeOrAuthError(err)) {
      warnings.push(calendarScopeHint("microsoft"));
    } else {
      warnings.push(`Microsoft (${email}): could not load calendar events.`);
    }
    return { events: [], warnings };
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
    const [googleResult, microsoftAccounts] = await Promise.all([
      fetchGoogleEvents(userId, start, end),
      prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
    ]);

    const msResults = await Promise.all(
      microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
    );
    const msEvents = msResults.flatMap((r) => r.events);
    const warnings = [
      ...googleResult.warnings,
      ...msResults.flatMap((r) => r.warnings),
    ];

    const hasGmail = await prisma.mailAccount.count({ where: { userId, provider: "gmail" } });
    const hasGoogleLegacy = Boolean(await getGoogleCredentials(userId));
    if ((hasGmail > 0 || hasGoogleLegacy) && googleResult.events.length === 0 && !googleResult.warnings.length) {
      warnings.push(
        "Google Calendar returned no events. If you connected Gmail before calendar support, reconnect Gmail in Mail."
      );
    }

    const all = [...googleResult.events, ...msEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    sendSuccess(res, { events: all, count: all.length, warnings });
  } catch (e) {
    throw new HttpError(500, `Calendar fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});

// Exported helper for AI briefing
export async function fetchCalendarToday(userId: string, start: string, end: string): Promise<Array<{ title: string; start: string }>> {
  const [googleResult, microsoftAccounts] = await Promise.all([
    fetchGoogleEvents(userId, start, end),
    prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
  ]);
  const msResults = await Promise.all(
    microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
  );
  return [...googleResult.events, ...msResults.flatMap((r) => r.events)]
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
    const [googleResult, microsoftAccounts] = await Promise.all([
      fetchGoogleEvents(userId, start, end),
      prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } }),
    ]);
    const msResults = await Promise.all(
      microsoftAccounts.map((acc) => fetchMicrosoftEvents(userId, acc.email, start, end))
    );
    const all = [...googleResult.events, ...msResults.flatMap((r) => r.events)].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    const warnings = [
      ...googleResult.warnings,
      ...msResults.flatMap((r) => r.warnings),
    ];
    sendSuccess(res, { events: all, warnings });
  } catch (e) {
    throw new HttpError(500, `Calendar fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});
