import type { Credentials } from "google-auth-library";
import { google } from "googleapis";
import { createOAuth2ClientAsync } from "../gmail/gmail-service.js";
import { persistGoogleCredentials } from "../gmail/google-token-store.js";

export const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function hasGoogleCalendarScope(creds: Credentials): boolean {
  const scope = creds.scope ?? "";
  return scope.includes("calendar.readonly") || scope.includes("calendar.events");
}

export function isGoogleAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|401|400|invalid_grant|invalid_request|insufficient|scope|permission|consent|forbidden|token has been expired|token has been revoked/i.test(
    msg
  );
}

export async function googleCalendarForCredentials(
  creds: Credentials,
  userId: string,
  mailAccountId?: string
) {
  const auth = await createOAuth2ClientAsync();
  auth.setCredentials(creds);
  let latest = { ...creds };
  auth.on("tokens", (tokens) => {
    latest = { ...latest, ...tokens };
    void persistGoogleCredentials(userId, latest, mailAccountId).catch((err) => {
      console.warn("[calendar] failed to persist refreshed tokens:", err);
    });
  });
  return google.calendar({ version: "v3", auth });
}
