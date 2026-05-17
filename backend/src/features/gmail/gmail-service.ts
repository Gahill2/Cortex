import type { Credentials } from "google-auth-library";
import { google } from "googleapis";
import { env } from "../../config/env.js";
import { getGoogleCredentials } from "./google-token-store.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email"
];

const getRedirectUri = () => env.GOOGLE_REDIRECT_URI || "";

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

export const createOAuth2Client = () =>
  new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getRedirectUri() || undefined);

export const buildGmailAuthUrl = (state: string): string => {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state
  });
};

export const exchangeAuthorizationCode = async (code: string) => {
  const client = createOAuth2Client();
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
