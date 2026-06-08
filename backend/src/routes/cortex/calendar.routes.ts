import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import {
  getGoogleCredentials,
  getGoogleCredentialsForEmail,
} from "../../features/gmail/google-token-store.js";
import {
  googleCalendarForCredentials,
  hasGoogleCalendarScope,
  isGoogleAuthError,
} from "../../features/calendar/google-calendar-client.js";
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
  /** Provider-native event id (for updates). */
  providerEventId: string;
  /** Google calendar id; required for Google updates. */
  calendarId?: string;
  /** Microsoft linked account email when multiple mail accounts exist. */
  accountEmail?: string;
}

const patchEventSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  source: z.enum(["google", "microsoft"]),
  providerEventId: z.string().min(1),
  calendarId: z.string().optional(),
  accountEmail: z.string().email().optional(),
  timeZone: z.string().optional(),
  allDay: z.boolean().optional(),
});

function clientTimeZone(tz?: string): string {
  const trimmed = tz?.trim();
  if (trimmed) return trimmed;
  return "UTC";
}

type FetchResult = { events: CalendarEvent[]; warnings: string[] };

function calendarScopeHint(source: "google" | "microsoft"): string {
  if (source === "google") {
    return "Reconnect Gmail in Mail to grant Google Calendar access (calendar permission was added).";
  }
  return "Reconnect Microsoft in Mail to grant calendar access (Calendars.Read was added).";
}

function isScopeOrAuthError(err: unknown): boolean {
  return isGoogleAuthError(err);
}

type GoogleCalendarSource = {
  credentials: import("google-auth-library").Credentials;
  mailAccountId?: string;
  accountEmail?: string;
};

async function listGoogleCalendarSources(userId: string): Promise<GoogleCalendarSource[]> {
  const mailAccounts = await prisma.mailAccount.findMany({
    where: { userId, provider: "gmail" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const sources: GoogleCalendarSource[] = [];
  const seenRefresh = new Set<string>();

  for (const acc of mailAccounts) {
    if (!acc.tokens) continue;
    const credentials = JSON.parse(acc.tokens) as GoogleCalendarSource["credentials"];
    const refreshKey = credentials.refresh_token ?? acc.id;
    if (seenRefresh.has(refreshKey)) continue;
    seenRefresh.add(refreshKey);
    sources.push({
      credentials,
      mailAccountId: acc.id,
      accountEmail: acc.email,
    });
  }

  if (!sources.length) {
    const legacy = await getGoogleCredentials(userId);
    if (legacy?.access_token || legacy?.refresh_token) {
      sources.push({ credentials: legacy });
    }
  }

  return sources;
}

async function fetchGoogleEventsForSource(
  userId: string,
  source: GoogleCalendarSource,
  timeMin: string,
  timeMax: string
): Promise<FetchResult> {
  const warnings: string[] = [];
  const { credentials, mailAccountId, accountEmail } = source;
  const label = accountEmail ?? "Google account";

  if (!credentials.access_token && !credentials.refresh_token) {
    return { events: [], warnings };
  }

  if (!hasGoogleCalendarScope(credentials)) {
    warnings.push(`${label}: reconnect Gmail in Mail to grant Google Calendar access.`);
    return { events: [], warnings };
  }

  const cal = await googleCalendarForCredentials(credentials, userId, mailAccountId);

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
          maxResults: 100,
        });
        for (const ev of evRes.data.items ?? []) {
          const allDay = Boolean(ev.start?.date && !ev.start.dateTime);
          const providerEventId = ev.id ?? "";
          events.push({
            id: `google_${calId}_${providerEventId}`,
            title: ev.summary ?? "(No title)",
            start: ev.start?.dateTime ?? ev.start?.date ?? "",
            end: ev.end?.dateTime ?? ev.end?.date ?? "",
            allDay,
            location: ev.location ?? undefined,
            description: ev.description ?? undefined,
            source: "google",
            calendarName: calendar.summary ?? undefined,
            color,
            providerEventId,
            calendarId: calId,
            accountEmail,
          });
        }
      } catch (err) {
        console.warn("[calendar] google calendar events skipped:", calId, err);
      }
    }
    return { events, warnings };
  } catch (err) {
    console.error("[calendar] google fetch failed for", label, err);
    if (isScopeOrAuthError(err)) {
      if (/invalid_grant|revoked/i.test(err instanceof Error ? err.message : String(err))) {
        warnings.push(`${label}: session expired — reconnect this Gmail account in Mail.`);
      } else {
        warnings.push(`${label}: ${calendarScopeHint("google")}`);
      }
    } else {
      warnings.push(`${label}: could not load Google Calendar. Try reconnecting Gmail in Mail.`);
    }
    return { events: [], warnings };
  }
}

async function fetchGoogleEvents(userId: string, timeMin: string, timeMax: string): Promise<FetchResult> {
  const sources = await listGoogleCalendarSources(userId);
  if (!sources.length) {
    return { events: [], warnings: [] };
  }

  const results = await Promise.all(
    sources.map((source) => fetchGoogleEventsForSource(userId, source, timeMin, timeMax))
  );

  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    warnings.push(...result.warnings);
    for (const ev of result.events) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      events.push(ev);
    }
  }

  return { events, warnings };
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
        const providerEventId = ev.id as string;
        events.push({
          id: `microsoft_${providerEventId}`,
          title: (ev.subject as string) ?? "(No title)",
          start: start.dateTime,
          end:   end.dateTime,
          allDay,
          location: (ev.location as { displayName?: string })?.displayName ?? undefined,
          description: (ev.bodyPreview as string) ?? undefined,
          source: "microsoft",
          calendarName: cal.name,
          color: undefined,
          providerEventId,
          accountEmail: email,
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

// ── Updates ────────────────────────────────────────────────────────────────────

async function patchGoogleEvent(
  userId: string,
  calendarId: string,
  eventId: string,
  start: string,
  end: string,
  allDay: boolean,
  timeZone: string,
  accountEmail?: string
): Promise<void> {
  let creds = await getGoogleCredentials(userId);
  let mailAccountId: string | undefined;

  if (accountEmail) {
    const match = await getGoogleCredentialsForEmail(userId, accountEmail);
    if (match) {
      creds = match.credentials;
      mailAccountId = match.mailAccountId;
    }
  } else if (calendarId.includes("@")) {
    const match = await getGoogleCredentialsForEmail(userId, calendarId);
    if (match) {
      creds = match.credentials;
      mailAccountId = match.mailAccountId;
    }
  }

  if (!creds?.access_token && !creds?.refresh_token) {
    throw new HttpError(403, "Google Calendar is not connected");
  }

  const cal = await googleCalendarForCredentials(creds, userId, mailAccountId);

  const requestBody = allDay
    ? {
        start: { date: start.slice(0, 10) },
        end: { date: end.slice(0, 10) },
      }
    : {
        start: { dateTime: start, timeZone },
        end: { dateTime: end, timeZone },
      };

  await cal.events.patch({
    calendarId,
    eventId,
    requestBody,
  });
}

async function patchMicrosoftEvent(
  userId: string,
  accountEmail: string | undefined,
  eventId: string,
  start: string,
  end: string,
  allDay: boolean,
  timeZone: string
): Promise<void> {
  const accounts = await prisma.mailAccount.findMany({ where: { userId, provider: "microsoft" } });
  const account = accountEmail
    ? accounts.find((a) => a.email.toLowerCase() === accountEmail.toLowerCase())
    : accounts[0];
  if (!account) {
    throw new HttpError(403, "Microsoft calendar account is not connected");
  }

  const token = await getValidMicrosoftToken(userId, account.email);
  const body = allDay
    ? {
        isAllDay: true,
        start: { dateTime: start.slice(0, 10), timeZone },
        end: { dateTime: end.slice(0, 10), timeZone },
      }
    : {
        isAllDay: false,
        start: { dateTime: start, timeZone },
        end: { dateTime: end, timeZone },
      };

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${timeZone}"`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(res.status === 403 ? 403 : 502, `Microsoft Calendar update failed: ${text.slice(0, 200)}`);
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// PATCH /calendar/events — move or resize an event
cortexCalendarRouter.patch("/events", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const parsed = patchEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { start, end, source, providerEventId, calendarId, accountEmail, timeZone, allDay } = parsed.data;
  const tz = clientTimeZone(timeZone);
  const isAllDay = allDay ?? false;

  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new HttpError(400, "End must be after start");
  }

  try {
    if (source === "google") {
      if (!calendarId) {
        throw new HttpError(400, "calendarId is required for Google events");
      }
      await patchGoogleEvent(
        userId,
        calendarId,
        providerEventId,
        start,
        end,
        isAllDay,
        tz,
        accountEmail
      );
    } else {
      await patchMicrosoftEvent(userId, accountEmail, providerEventId, start, end, isAllDay, tz);
    }
    sendSuccess(res, { ok: true, start, end }, "live");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Calendar update failed: ${e instanceof Error ? e.message : e}`);
  }
});

// GET /calendar/status — connection health for Google / Microsoft calendars
cortexCalendarRouter.get("/status", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const googleSources = await listGoogleCalendarSources(userId);
  const googleAccounts: Array<{
    email: string;
    isPrimary: boolean;
    hasCalendarScope: boolean;
    needsReconnect: boolean;
    calendarCount: number | null;
    error?: string;
  }> = [];

  const mailAccounts = await prisma.mailAccount.findMany({
    where: { userId, provider: "gmail" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  for (const acc of mailAccounts) {
    if (!acc.tokens) {
      googleAccounts.push({
        email: acc.email,
        isPrimary: acc.isPrimary,
        hasCalendarScope: false,
        needsReconnect: true,
        calendarCount: null,
        error: "No tokens stored",
      });
      continue;
    }

    const credentials = JSON.parse(acc.tokens) as import("google-auth-library").Credentials;
    const hasCalendarScope = hasGoogleCalendarScope(credentials);
    let needsReconnect = !hasCalendarScope;
    let calendarCount: number | null = null;
    let error: string | undefined;

    if (hasCalendarScope) {
      try {
        const cal = await googleCalendarForCredentials(credentials, userId, acc.id);
        const listRes = await cal.calendarList.list({ minAccessRole: "reader" });
        calendarCount = listRes.data.items?.length ?? 0;
      } catch (err) {
        needsReconnect = true;
        error = err instanceof Error ? err.message : String(err);
      }
    } else {
      error = "Calendar permission not granted";
    }

    googleAccounts.push({
      email: acc.email,
      isPrimary: acc.isPrimary,
      hasCalendarScope,
      needsReconnect,
      calendarCount,
      error,
    });
  }

  if (!googleAccounts.length && googleSources.length) {
    const legacy = googleSources[0];
    const hasCalendarScope = hasGoogleCalendarScope(legacy.credentials);
    let calendarCount: number | null = null;
    let needsReconnect = !hasCalendarScope;
    let error: string | undefined;
    if (hasCalendarScope) {
      try {
        const cal = await googleCalendarForCredentials(legacy.credentials, userId);
        const listRes = await cal.calendarList.list({ minAccessRole: "reader" });
        calendarCount = listRes.data.items?.length ?? 0;
      } catch (err) {
        needsReconnect = true;
        error = err instanceof Error ? err.message : String(err);
      }
    }
    googleAccounts.push({
      email: "Google account",
      isPrimary: true,
      hasCalendarScope,
      needsReconnect,
      calendarCount,
      error,
    });
  }

  const microsoftAccounts = await prisma.mailAccount.findMany({
    where: { userId, provider: "microsoft" },
    select: { email: true, isPrimary: true },
  });

  sendSuccess(
    res,
    {
      google: googleAccounts,
      microsoft: microsoftAccounts.map((a) => ({
        email: a.email,
        isPrimary: a.isPrimary,
      })),
      hasGoogle: googleAccounts.length > 0,
      hasMicrosoft: microsoftAccounts.length > 0,
      needsGoogleReconnect: googleAccounts.some((a) => a.needsReconnect),
    },
    "live"
  );
});

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

    sendSuccess(res, { events: all, count: all.length, warnings }, "live");
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
    sendSuccess(res, { events: all, warnings }, "live");
  } catch (e) {
    throw new HttpError(500, `Calendar fetch failed: ${e instanceof Error ? e.message : e}`);
  }
});
