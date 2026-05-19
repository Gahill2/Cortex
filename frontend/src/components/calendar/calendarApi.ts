import { api } from "../../api/client";
import type { CalendarEvent } from "./calendarTypes";
import { getClientTimeZone } from "./calendarLayout";

export function normalizeEvent(ev: CalendarEvent): CalendarEvent {
  if (ev.providerEventId) return ev;

  if (ev.source === "microsoft" && ev.id.startsWith("microsoft_")) {
    return { ...ev, providerEventId: ev.id.slice("microsoft_".length) };
  }

  if (ev.source === "google" && ev.id.startsWith("google_")) {
    const rest = ev.id.slice("google_".length);
    const idx = rest.indexOf("_");
    if (idx > 0) {
      return {
        ...ev,
        calendarId: ev.calendarId ?? rest.slice(0, idx),
        providerEventId: rest.slice(idx + 1),
      };
    }
    return { ...ev, providerEventId: rest };
  }

  return { ...ev, providerEventId: ev.id };
}

export async function patchCalendarEvent(
  ev: CalendarEvent,
  start: string,
  end: string,
  allDay?: boolean
): Promise<void> {
  const normalized = normalizeEvent(ev);
  await api.patch("/calendar/events", {
    start,
    end,
    source: normalized.source,
    providerEventId: normalized.providerEventId,
    calendarId: normalized.calendarId,
    accountEmail: normalized.accountEmail,
    timeZone: getClientTimeZone(),
    allDay: allDay ?? normalized.allDay,
  });
}
