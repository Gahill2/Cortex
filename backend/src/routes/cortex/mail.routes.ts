import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { prisma } from "../../db/prisma.js";
import { signMailOAuthState, verifyMailOAuthState } from "../../features/mail/mail-oauth-state.js";
import {
  isGmailConfigured,
} from "../../features/gmail/gmail-service.js";
import type { Credentials } from "google-auth-library";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import nodemailer from "nodemailer";

export const cortexMailRouter = Router();

// ── Mail-specific OAuth URL builder
// Uses MAIL_REDIRECT_URI if set, otherwise falls back to GOOGLE_REDIRECT_URI.
// To add additional Gmail accounts you need to register the mail callback URI
// in Google Cloud Console: <backend-url>/api/cortex/mail/accounts/gmail/callback

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

const getMailRedirectUri = (): string =>
  process.env.MAIL_REDIRECT_URI || env.GOOGLE_REDIRECT_URI || "";

const createMailOAuth2Client = () => {
  const { OAuth2 } = google.auth;
  return new OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getMailRedirectUri());
};

const buildMailAuthUrl = (state: string): string => {
  const client = createMailOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state,
  });
};

const exchangeMailCode = async (code: string): Promise<Credentials> => {
  const client = createMailOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMailToken = async (userId: string, email: string): Promise<Credentials | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: `mail_gmail:${email}` } },
  });
  return row ? (JSON.parse(row.tokens) as Credentials) : null;
};

const saveMailToken = async (userId: string, email: string, creds: Credentials): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: `mail_gmail:${email}` } },
    update: { tokens: JSON.stringify(creds) },
    create: { userId, provider: `mail_gmail:${email}`, tokens: JSON.stringify(creds) },
  });
};

const deleteMailToken = async (userId: string, email: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({
    where: { userId, provider: `mail_gmail:${email}` },
  });
};

const gmailClientForAccount = async (userId: string, email: string) => {
  const creds = await getMailToken(userId, email);
  if (!creds?.access_token && !creds?.refresh_token) return null;
  const auth = createMailOAuth2Client();
  auth.setCredentials(creds);
  return google.gmail({ version: "v1", auth });
};

const nodemailerTransport = (account: {
  smtpHost: string | null;
  smtpPort: number | null;
  username: string | null;
  passwordEnc: string | null;
}) => {
  if (!account.smtpHost || !account.username || !account.passwordEnc) {
    throw new HttpError(400, "IMAP account missing SMTP credentials");
  }
  const password = Buffer.from(account.passwordEnc, "base64").toString("utf-8");
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort ?? 587,
    secure: (account.smtpPort ?? 587) === 465,
    auth: { user: account.username, pass: password },
  });
};

// ── GET /api/mail/accounts ─────────────────────────────────────────────────
cortexMailRouter.get("/accounts", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const accounts = await prisma.mailAccount.findMany({
    where: { userId: req.auth!.userId },
    orderBy: { createdAt: "asc" },
  });
  sendSuccess(res, { accounts });
});

// ── POST /api/mail/accounts/gmail/connect ────────────────────────────────────
cortexMailRouter.post(
  "/accounts/gmail/connect",
  requireAuth,
  routeRateLimit(10, 60_000),
  (req, res) => {
    if (!isGmailConfigured()) {
      throw new HttpError(503, "Gmail OAuth is not configured.");
    }
    const isDesktop = req.body?.desktop === true || req.query.desktop === "1";
    const state = signMailOAuthState(req.auth!.userId, isDesktop);
    const url = buildMailAuthUrl(state);
    sendSuccess(res, { url }, "live");
  }
);

// ── GET /api/mail/accounts/gmail/callback ────────────────────────────────────
cortexMailRouter.get(
  "/accounts/gmail/callback",
  routeRateLimit(60, 60_000),
  async (req, res) => {
    const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
    const stateParam =
      typeof req.query.state === "string" ? req.query.state : "";

    let isDesktop = frontend.startsWith("cortex://");
    try {
      const { desktop } = verifyMailOAuthState(stateParam);
      isDesktop = isDesktop || desktop;
    } catch {
      /* state parse failure handled below */
    }

    const ok = (email: string) =>
      isDesktop
        ? `cortex://oauth/mail?connected=1&email=${encodeURIComponent(email)}`
        : `${frontend}/?mail_connected=1&email=${encodeURIComponent(email)}`;
    const err = (msg: string) =>
      isDesktop
        ? `cortex://oauth/mail?error=${encodeURIComponent(msg)}`
        : `${frontend}/?mail_error=${encodeURIComponent(msg)}`;

    try {
      if (typeof req.query.error === "string") {
        res.redirect(err(req.query.error));
        return;
      }
      const code = req.query.code;
      const state = req.query.state;
      if (typeof code !== "string" || typeof state !== "string") {
        res.redirect(err("missing_code"));
        return;
      }
      const { userId } = verifyMailOAuthState(state);
      const tokens = await exchangeMailCode(code);

      // Get the email address from Google
      const tempAuth = createMailOAuth2Client();
      tempAuth.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: tempAuth });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      if (!email) {
        res.redirect(err("no_email_returned"));
        return;
      }

      // Save token and MailAccount
      await saveMailToken(userId, email, tokens);
      await prisma.mailAccount.upsert({
        where: { userId_email: { userId, email } },
        update: { provider: "gmail", label: email },
        create: {
          userId,
          provider: "gmail",
          label: email,
          email,
        },
      });

      res.redirect(ok(email));
    } catch {
      res.redirect(err("oauth_failed"));
    }
  }
);

// ── POST /api/mail/accounts/imap ─────────────────────────────────────────────
const imapBodySchema = z.object({
  label: z.string().min(1).max(100),
  email: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().default(993),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().default(587),
  username: z.string().min(1),
  password: z.string().min(1),
});

cortexMailRouter.post(
  "/accounts/imap",
  requireAuth,
  routeRateLimit(10, 60_000),
  async (req, res) => {
    const body = imapBodySchema.parse(req.body);

    // Test SMTP connection before saving
    const passwordEnc = Buffer.from(body.password, "utf-8").toString("base64");
    const transport = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure: body.smtpPort === 465,
      auth: { user: body.username, pass: body.password },
    });
    try {
      await transport.verify();
    } catch (e) {
      throw new HttpError(
        400,
        `Cannot connect to SMTP server: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    const account = await prisma.mailAccount.upsert({
      where: { userId_email: { userId: req.auth!.userId, email: body.email } },
      update: {
        provider: "imap",
        label: body.label,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        username: body.username,
        passwordEnc,
      },
      create: {
        userId: req.auth!.userId,
        provider: "imap",
        label: body.label,
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        username: body.username,
        passwordEnc,
      },
    });
    sendSuccess(res, { account }, "live");
  }
);

// ── DELETE /api/mail/accounts/:accountId ─────────────────────────────────────
cortexMailRouter.delete(
  "/accounts/:accountId",
  requireAuth,
  routeRateLimit(20, 60_000),
  async (req, res) => {
    const accountId = String(req.params.accountId);
    const account = await prisma.mailAccount.findFirst({
      where: { id: accountId, userId: req.auth!.userId },
    });
    if (!account) throw new HttpError(404, "Account not found");

    if (account.provider === "gmail") {
      await deleteMailToken(req.auth!.userId, account.email);
    }
    await prisma.mailAccount.delete({ where: { id: account.id } });
    sendSuccess(res, { deleted: true }, "live");
  }
);

// ── GET /api/mail/inbox ───────────────────────────────────────────────────────
const inboxQuerySchema = z.object({
  accountId: z.string().optional(),
  unified: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().max(500).optional().default("in:inbox"),
});

type MailMessage = {
  id: string;
  accountId: string;
  accountEmail: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  threadId: string;
};

cortexMailRouter.get(
  "/inbox",
  requireAuth,
  routeRateLimit(60, 60_000),
  async (req, res) => {
    const input = inboxQuerySchema.parse(req.query);
    const userId = req.auth!.userId;

    let accountsToFetch = await prisma.mailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (input.accountId && input.accountId !== "all") {
      accountsToFetch = accountsToFetch.filter((a) => a.id === input.accountId);
    }

    const allMessages: MailMessage[] = [];

    for (const account of accountsToFetch) {
      if (account.provider === "gmail") {
        try {
          const gmail = await gmailClientForAccount(userId, account.email);
          if (!gmail) continue;

          const listRes = await gmail.users.messages.list({
            userId: "me",
            maxResults: input.maxResults,
            q: input.q || "in:inbox",
          });
          const ids = (listRes.data.messages ?? [])
            .map((m) => m.id)
            .filter(Boolean) as string[];

          for (const id of ids.slice(0, input.maxResults)) {
            const detail = await gmail.users.messages.get({
              userId: "me",
              id,
              format: "metadata",
              metadataHeaders: ["Subject", "From", "Date"],
            });
            const md = detail.data;
            const headers = md.payload?.headers ?? [];
            const labelIds = md.labelIds ?? [];
            const hdr = (key: string) =>
              headers.find(
                (h) => (h.name ?? "").toLowerCase() === key.toLowerCase()
              )?.value ?? "";

            allMessages.push({
              id: md.id ?? id,
              accountId: account.id,
              accountEmail: account.email,
              subject: hdr("Subject") || "(no subject)",
              from: hdr("From") || "",
              date: hdr("Date") || "",
              snippet: md.snippet ?? "",
              unread: labelIds.includes("UNREAD"),
              threadId: md.threadId ?? "",
            });
          }
        } catch {
          // skip failed accounts
        }
      }
      // IMAP accounts: would need imapflow here; skipped for now (returns empty)
    }

    // Sort by date descending (best-effort)
    allMessages.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    sendSuccess(res, { messages: allMessages }, "live");
  }
);

// ── GET /api/mail/message/:accountId/:messageId ───────────────────────────────
cortexMailRouter.get(
  "/message/:accountId/:messageId",
  requireAuth,
  routeRateLimit(60, 60_000),
  async (req, res) => {
    const accountId = String(req.params.accountId);
    const messageId = String(req.params.messageId);
    const account = await prisma.mailAccount.findFirst({
      where: { id: accountId, userId: req.auth!.userId },
    });
    if (!account) throw new HttpError(404, "Account not found");

    if (account.provider !== "gmail") {
      throw new HttpError(501, "Full message body only supported for Gmail accounts");
    }

    const gmail = await gmailClientForAccount(req.auth!.userId, account.email);
    if (!gmail) throw new HttpError(401, "Gmail account not connected");

    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    // Extract body: prefer HTML, fallback to plain text
    const extractBody = (payload: gmail_v1.Schema$MessagePart | null | undefined): string => {
      if (!payload) return "";
      const parts = payload.parts ?? [];
      const htmlPart = parts.find((p: gmail_v1.Schema$MessagePart) => p.mimeType === "text/html");
      const textPart = parts.find((p: gmail_v1.Schema$MessagePart) => p.mimeType === "text/plain");
      const chosen = htmlPart ?? textPart ?? payload;
      const data = chosen?.body?.data ?? "";
      return Buffer.from(data, "base64url").toString("utf-8");
    };

    const headers = msg.data.payload?.headers ?? [];
    const hdr = (key: string) =>
      headers.find((h: gmail_v1.Schema$MessagePartHeader) => (h.name ?? "").toLowerCase() === key.toLowerCase())
        ?.value ?? "";

    sendSuccess(
      res,
      {
        id: msg.data.id,
        threadId: msg.data.threadId,
        subject: hdr("Subject"),
        from: hdr("From"),
        to: hdr("To"),
        date: hdr("Date"),
        body: extractBody(msg.data.payload),
        mimeType: msg.data.payload?.mimeType,
        labelIds: msg.data.labelIds ?? [],
      },
      "live"
    );
  }
);

// ── POST /api/mail/send ───────────────────────────────────────────────────────
const sendBodySchema = z.object({
  accountId: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  replyToMessageId: z.string().optional(),
});

cortexMailRouter.post(
  "/send",
  requireAuth,
  routeRateLimit(20, 60_000),
  async (req, res) => {
    const input = sendBodySchema.parse(req.body);
    const account = await prisma.mailAccount.findFirst({
      where: { id: input.accountId, userId: req.auth!.userId },
    });
    if (!account) throw new HttpError(404, "Account not found");

    if (account.provider === "gmail") {
      const gmail = await gmailClientForAccount(req.auth!.userId, account.email);
      if (!gmail) throw new HttpError(401, "Gmail account not connected");

      const raw = Buffer.from(
        [
          `To: ${input.to}`,
          `Subject: ${input.subject}`,
          "Content-Type: text/plain; charset=utf-8",
          "MIME-Version: 1.0",
          "",
          input.body,
        ].join("\r\n")
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      let threadId: string | undefined;
      if (input.replyToMessageId) {
        const orig = await gmail.users.messages.get({
          userId: "me",
          id: input.replyToMessageId,
          format: "metadata",
          metadataHeaders: ["Message-ID"],
        });
        threadId = orig.data.threadId ?? undefined;
      }
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw, ...(threadId ? { threadId } : {}) },
      });
    } else {
      const transport = nodemailerTransport(account);
      await transport.sendMail({
        from: account.email,
        to: input.to,
        subject: input.subject,
        text: input.body,
      });
    }

    sendSuccess(res, { sent: true }, "live");
  }
);

// ── PATCH /api/mail/message/:accountId/:messageId ────────────────────────────
const patchBodySchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
  starred: z.boolean().optional(),
});

cortexMailRouter.patch(
  "/message/:accountId/:messageId",
  requireAuth,
  routeRateLimit(40, 60_000),
  async (req, res) => {
    const input = patchBodySchema.parse(req.body);
    const accountId = String(req.params.accountId);
    const messageId = String(req.params.messageId);
    const account = await prisma.mailAccount.findFirst({
      where: { id: accountId, userId: req.auth!.userId },
    });
    if (!account) throw new HttpError(404, "Account not found");

    if (account.provider !== "gmail") {
      throw new HttpError(501, "Message mutation only supported for Gmail accounts");
    }
    const gmail = await gmailClientForAccount(req.auth!.userId, account.email);
    if (!gmail) throw new HttpError(401, "Gmail account not connected");

    const addLabelIds: string[] = [];
    const removeLabelIds: string[] = [];

    if (input.read === true) removeLabelIds.push("UNREAD");
    if (input.read === false) addLabelIds.push("UNREAD");
    if (input.archived === true) removeLabelIds.push("INBOX");
    if (input.starred === true) addLabelIds.push("STARRED");
    if (input.starred === false) removeLabelIds.push("STARRED");

    if (addLabelIds.length || removeLabelIds.length) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds, removeLabelIds },
      });
    }

    sendSuccess(res, { updated: true }, "live");
  }
);
