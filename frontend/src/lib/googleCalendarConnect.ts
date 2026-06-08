import { api } from "../api/client";
import { startOAuthFlow } from "./oauth";

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean };
};

const isElectron = () => !!(window as ElectronWindow).electron?.isElectron;

export type CalendarAccountStatus = {
  email: string;
  isPrimary: boolean;
  hasCalendarScope: boolean;
  needsReconnect: boolean;
  calendarCount: number | null;
  error?: string;
};

export type CalendarConnectionStatus = {
  google: CalendarAccountStatus[];
  microsoft: Array<{ email: string; isPrimary: boolean }>;
  hasGoogle: boolean;
  hasMicrosoft: boolean;
  needsGoogleReconnect: boolean;
};

export async function fetchCalendarStatus(): Promise<CalendarConnectionStatus | null> {
  try {
    const r = await api.get<{ data?: CalendarConnectionStatus }>("/calendar/status");
    return r.data?.data ?? null;
  } catch {
    return null;
  }
}

export async function connectGoogleCalendar(): Promise<void> {
  const r = await api.post<{ data?: { url: string } }>("/mail/accounts/gmail/connect", {
    desktop: isElectron(),
    returnOrigin: window.location.origin,
  });
  const url = r.data?.data?.url;
  if (!url) {
    throw new Error("No authorization URL returned.");
  }
  startOAuthFlow(url);
}
