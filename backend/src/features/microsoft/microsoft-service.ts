import { env } from "../../config/env.js";
import { resolveMicrosoftOAuthRedirectUri } from "../oauth/oauth-frontend-redirect.js";
import { prisma } from "../../db/prisma.js";

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";

/** Mail + calendar read; reconnect Microsoft in Mail after scope changes. */
const SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.ReadWrite",
  "Calendars.Read",
].join(" ");

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

export function isMicrosoftConfigured(): boolean {
  return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
}

// ── OAuth URL ─────────────────────────────────────────────────────────────────

export function buildMicrosoftAuthUrl(state: string, returnOrigin?: string): string {
  const redirect_uri = resolveMicrosoftOAuthRedirectUri(returnOrigin);
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri,
    scope: SCOPES,
    response_mode: "query",
    prompt: "select_account",
    state,
  });
  return `${AUTHORITY}/authorize?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeMicrosoftCode(code: string, returnOrigin?: string): Promise<MicrosoftTokens> {
  const redirect_uri = resolveMicrosoftOAuthRedirectUri(returnOrigin);
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri,
    grant_type: "authorization_code",
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshMicrosoftToken(tokens: MicrosoftTokens): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
    scope: SCOPES,
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Microsoft token refresh failed");
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ── Token store ───────────────────────────────────────────────────────────────

const providerKey = (email: string) => `mail_microsoft:${email}`;

export async function saveMicrosoftTokens(userId: string, email: string, tokens: MicrosoftTokens) {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: providerKey(email) } },
    update: { tokens: JSON.stringify(tokens) },
    create: { userId, provider: providerKey(email), tokens: JSON.stringify(tokens) },
  });
}

export async function getMicrosoftTokens(userId: string, email: string): Promise<MicrosoftTokens | null> {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: providerKey(email) } },
  });
  return row ? (JSON.parse(row.tokens) as MicrosoftTokens) : null;
}

export async function deleteMicrosoftTokens(userId: string, email: string) {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: providerKey(email) } });
}

export async function getValidMicrosoftToken(userId: string, email: string): Promise<string> {
  let tokens = await getMicrosoftTokens(userId, email);
  if (!tokens) throw new Error("Microsoft account not connected");
  if (Date.now() > tokens.expires_at - 60_000) {
    tokens = await refreshMicrosoftToken(tokens);
    await saveMicrosoftTokens(userId, email, tokens);
  }
  return tokens.access_token;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

async function graphRequest(
  token: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Graph API ${res.status} ${path}${detail ? `: ${detail.slice(0, 240)}` : ""}`
    );
  }
  return res;
}

async function graphGet<T>(token: string, path: string): Promise<T> {
  const res = await graphRequest(token, path);
  return res.json() as Promise<T>;
}

// ── User profile ──────────────────────────────────────────────────────────────

export async function getMicrosoftUserEmail(token: string): Promise<string> {
  const data = (await graphGet<{ mail?: string; userPrincipalName?: string }>(token, "/me"));
  return data.mail ?? data.userPrincipalName ?? "";
}

// ── Mail ──────────────────────────────────────────────────────────────────────

export interface OutlookMessage {
  id: string;
  accountId: string;
  accountEmail: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  threadId: string;
}

export async function listOutlookInbox(
  userId: string,
  email: string,
  accountId: string,
  maxResults = 20
): Promise<OutlookMessage[]> {
  const token = await getValidMicrosoftToken(userId, email);
  const data = await graphGet<{
    value: Array<{
      id: string;
      conversationId: string;
      subject: string;
      isRead: boolean;
      receivedDateTime: string;
      bodyPreview: string;
      from: { emailAddress: { name: string; address: string } };
    }>;
  }>(token, `/me/mailFolders/inbox/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,conversationId,subject,isRead,receivedDateTime,bodyPreview,from`);

  return (data.value ?? []).map((m) => ({
    id: m.id,
    accountId,
    accountEmail: email,
    subject: m.subject || "(no subject)",
    from: m.from?.emailAddress
      ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
      : "",
    date: m.receivedDateTime,
    snippet: m.bodyPreview ?? "",
    unread: !m.isRead,
    threadId: m.conversationId ?? m.id,
  }));
}

export async function getOutlookMessage(userId: string, email: string, messageId: string) {
  const token = await getValidMicrosoftToken(userId, email);
  const m = await graphGet<{
    id: string;
    conversationId: string;
    subject: string;
    isRead: boolean;
    receivedDateTime: string;
    bodyPreview: string;
    body: { contentType: string; content: string };
    from: { emailAddress: { name: string; address: string } };
    toRecipients: Array<{ emailAddress: { address: string } }>;
    labelIds?: string[];
  }>(token, `/me/messages/${messageId}?$select=id,conversationId,subject,isRead,receivedDateTime,bodyPreview,body,from,toRecipients`);

  return {
    id: m.id,
    threadId: m.conversationId,
    subject: m.subject,
    from: `${m.from?.emailAddress?.name} <${m.from?.emailAddress?.address}>`,
    to: m.toRecipients?.map((r) => r.emailAddress.address).join(", ") ?? "",
    date: m.receivedDateTime,
    body: m.body?.content ?? m.bodyPreview,
    mimeType: m.body?.contentType === "html" ? "text/html" : "text/plain",
    labelIds: [],
    isRead: m.isRead
  };
}

export async function markOutlookRead(userId: string, email: string, messageId: string) {
  const token = await getValidMicrosoftToken(userId, email);
  await graphRequest(token, `/me/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRead: true }),
  });
}

export async function archiveOutlookMessage(userId: string, email: string, messageId: string) {
  const token = await getValidMicrosoftToken(userId, email);
  await graphRequest(token, `/me/messages/${messageId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationId: "archive" }),
  });
}

export async function deleteOutlookMessage(userId: string, email: string, messageId: string) {
  const token = await getValidMicrosoftToken(userId, email);
  await graphRequest(token, `/me/messages/${messageId}`, { method: "DELETE" });
}

export async function sendOutlookMessage(
  userId: string,
  email: string,
  to: string,
  subject: string,
  body: string
) {
  const token = await getValidMicrosoftToken(userId, email);
  await fetch(`${GRAPH}/me/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}
