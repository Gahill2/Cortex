import type { Credentials } from "google-auth-library";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import { resolveGmailOAuthRedirectUri } from "../oauth/oauth-frontend-redirect.js";
import { getGoogleCredentials } from "./google-token-store.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

const getRedirectUri = (returnOrigin?: string) => resolveGmailOAuthRedirectUri(returnOrigin);

export const isGmailConfigured = (): boolean => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  const redirectUri = getRedirectUri();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !redirectUri) return false;
  try {
    void new URL(redirectUri);
    return true;
  } catch {
    return false;
  }
};

export const createOAuth2Client = (returnOrigin?: string) =>
  new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(returnOrigin) || undefined
  );

export const buildGmailAuthUrl = (state: string, returnOrigin?: string): string => {
  const client = createOAuth2Client(returnOrigin);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state
  });
};

export const exchangeAuthorizationCode = async (code: string, returnOrigin?: string) => {
  const client = createOAuth2Client(returnOrigin);
  const { tokens } = await client.getToken(code);
  return tokens;
};

const gmailClientForCredentials = (creds: Credentials) => {
  const auth = createOAuth2Client();
  auth.setCredentials(creds);
  return google.gmail({ version: "v1", auth });
};

const gmailForUser = async (userId: string, credsOverride?: Credentials) => {
  const creds = credsOverride ?? (await getGoogleCredentials(userId));
  if (!creds?.access_token && !creds?.refresh_token) {
    return null;
  }
  return gmailClientForCredentials(creds);
};

export async function fetchGoogleAccountEmail(tokens: Credentials): Promise<string | null> {
  try {
    const auth = createOAuth2Client();
    auth.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}

const headerVal = (headers: Array<{ name?: string | null; value?: string | null }> | undefined, key: string) =>
  headers?.find((h) => (h.name ?? "").toLowerCase() === key.toLowerCase())?.value ?? "";

export type InboxRow = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  labelIds: string[];
  unread: boolean;
};

export const listInbox = async (
  userId: string,
  maxResults: number,
  query: string,
  credsOverride?: Credentials
): Promise<{ connected: boolean; messages: InboxRow[] }> => {
  const gmail = await gmailForUser(userId, credsOverride);
  if (!gmail) {
    return { connected: false, messages: [] };
  }

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query || "in:inbox"
  });

  const ids = listRes.data.messages?.map((m) => m.id).filter(Boolean) as string[];
  if (!ids?.length) {
    return { connected: true, messages: [] };
  }

  const messages: InboxRow[] = [];
  for (const id of ids.slice(0, maxResults)) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"]
    });
    const md = detail.data;
    const headers = md.payload?.headers ?? [];
    const labelIds = md.labelIds ?? [];
    messages.push({
      id: md.id ?? id,
      threadId: md.threadId ?? "",
      snippet: md.snippet ?? "",
      subject: headerVal(headers, "Subject") || "(no subject)",
      from: headerVal(headers, "From") || "",
      date: headerVal(headers, "Date") || "",
      labelIds,
      unread: labelIds.includes("UNREAD")
    });
  }

  return { connected: true, messages };
};

export const modifyMessageLabels = async (
  userId: string,
  messageId: string,
  opts: { addLabelIds?: string[]; removeLabelIds?: string[] },
  credsOverride?: Credentials
): Promise<void> => {
  const gmail = await gmailForUser(userId, credsOverride);
  if (!gmail) {
    throw new Error("Gmail not connected");
  }
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: opts.addLabelIds,
      removeLabelIds: opts.removeLabelIds
    }
  });
};

export const trashGmailMessage = async (
  userId: string,
  messageId: string,
  credsOverride?: Credentials
): Promise<void> => {
  const gmail = await gmailForUser(userId, credsOverride);
  if (!gmail) throw new Error("Gmail not connected");
  await gmail.users.messages.trash({ userId: "me", id: messageId });
};

const decodeBody = (data?: string | null): string => {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
};

const extractBody = (
  payload: { mimeType?: string | null; body?: { data?: string | null }; parts?: Array<{ mimeType?: string | null; body?: { data?: string | null }; parts?: unknown[] }> } | null | undefined
): { body: string; mimeType: string } => {
  if (!payload) return { body: "", mimeType: "text/plain" };
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return { body: decodeBody(payload.body.data), mimeType: "text/plain" };
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return { body: decodeBody(payload.body.data), mimeType: "text/html" };
  }
  for (const part of payload.parts ?? []) {
    const hit = extractBody(part as typeof payload);
    if (hit.body) return hit;
  }
  if (payload.body?.data) {
    return { body: decodeBody(payload.body.data), mimeType: payload.mimeType ?? "text/plain" };
  }
  return { body: "", mimeType: "text/plain" };
};

export type GmailFullMessage = InboxRow & {
  to: string;
  body: string;
  mimeType: string;
};

export const getGmailMessage = async (
  userId: string,
  messageId: string,
  credsOverride?: Credentials
): Promise<GmailFullMessage | null> => {
  const gmail = await gmailForUser(userId, credsOverride);
  if (!gmail) return null;

  const detail = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const md = detail.data;
  const headers = md.payload?.headers ?? [];
  const labelIds = md.labelIds ?? [];
  const { body, mimeType } = extractBody(md.payload ?? undefined);

  return {
    id: md.id ?? messageId,
    threadId: md.threadId ?? "",
    snippet: md.snippet ?? "",
    subject: headerVal(headers, "Subject") || "(no subject)",
    from: headerVal(headers, "From") || "",
    to: headerVal(headers, "To") || "",
    date: headerVal(headers, "Date") || "",
    labelIds,
    unread: labelIds.includes("UNREAD"),
    body,
    mimeType
  };
};

/** List inbox messages up to `cap`, following Gmail pagination. */
export const listInboxUpTo = async (
  userId: string,
  cap: number,
  query: string,
  credsOverride?: Credentials
): Promise<{ connected: boolean; messages: InboxRow[] }> => {
  const gmail = await gmailForUser(userId, credsOverride);
  if (!gmail) return { connected: false, messages: [] };

  const messages: InboxRow[] = [];
  let pageToken: string | undefined;

  while (messages.length < cap) {
    const pageSize = Math.min(50, cap - messages.length);
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: pageSize,
      q: query || "in:inbox",
      pageToken
    });

    const ids = listRes.data.messages?.map((m) => m.id).filter(Boolean) as string[];
    if (!ids?.length) break;

    for (const id of ids) {
      if (messages.length >= cap) break;
      const detail = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"]
      });
      const md = detail.data;
      const headers = md.payload?.headers ?? [];
      const labelIds = md.labelIds ?? [];
      messages.push({
        id: md.id ?? id,
        threadId: md.threadId ?? "",
        snippet: md.snippet ?? "",
        subject: headerVal(headers, "Subject") || "(no subject)",
        from: headerVal(headers, "From") || "",
        date: headerVal(headers, "Date") || "",
        labelIds,
        unread: labelIds.includes("UNREAD")
      });
    }

    pageToken = listRes.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return { connected: true, messages };
};
