import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { signGmailOAuthState, verifyGmailOAuthState } from "../../features/gmail/gmail-state.js";
import {
  buildGmailAuthUrl,
  createOAuth2Client,
  exchangeAuthorizationCode,
  isGmailConfigured,
  listInbox,
  modifyMessageLabels
} from "../../features/gmail/gmail-service.js";
import { saveGoogleCredentials, getGoogleCredentials, clearGoogleCredentials } from "../../features/gmail/google-token-store.js";
import { verifyMailOAuthState } from "../../features/mail/mail-oauth-state.js";
import { upsertGmailAccount } from "../../features/mail/mail-account-store.js";
import { prisma } from "../../db/prisma.js";
import { google } from "googleapis";

const inboxQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().max(500).optional().default("in:inbox")
});

const messageIdBodySchema = z.object({
  messageId: z.string().min(1)
});

export const cortexGmailRouter = Router();

cortexGmailRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const configured = isGmailConfigured();
  const credentials =
    configured && req.auth?.userId ? await getGoogleCredentials(req.auth.userId) : null;
  const connected =
    configured &&
    Boolean(credentials?.refresh_token || credentials?.access_token);
  sendSuccess(res, {
    configured,
    connected
  });
});

cortexGmailRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isGmailConfigured()) {
    throw new HttpError(
      503,
      "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI on the API server."
    );
  }
  // desktop=1 query param lets the frontend signal Electron mode; we embed it in
  // the signed state JWT so Google passes it back to the callback unchanged.
  const isDesktop = req.query.desktop === "1";
  const state = signGmailOAuthState(req.auth!.userId, isDesktop);
  const url = buildGmailAuthUrl(state);
  sendSuccess(res, { url }, "live");
});

// ── Desktop OAuth exchange (Electron deep-link flow) ─────────────────────────
cortexGmailRouter.post("/oauth/exchange", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const { code, state } = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }).parse(req.body);
  const { userId } = verifyGmailOAuthState(state);
  if (userId !== req.auth!.userId) throw new HttpError(403, "State userId mismatch");
  const tokens = await exchangeAuthorizationCode(code);
  await saveGoogleCredentials(req.auth!.userId, tokens);
  sendSuccess(res, { connected: true });
});

cortexGmailRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";
  const code = req.query.code;

  // ── Peek at state purpose to dispatch between single-Gmail and multi-account Mail flows ──
  let statePurpose = "gmail";
  try {
    const peeked = JSON.parse(Buffer.from(stateParam.split(".")[1] ?? "", "base64url").toString());
    if (peeked?.purpose === "mail_gmail") statePurpose = "mail_gmail";
  } catch { /* default to gmail */ }

  // ── Multi-account Mail flow ───────────────────────────────────────────────
  if (statePurpose === "mail_gmail") {
    let isDesktop = frontend.startsWith("cortex://");
    try {
      const { desktop } = verifyMailOAuthState(stateParam);
      isDesktop = isDesktop || desktop;
    } catch { /* ignore */ }

    const ok  = (email: string) => isDesktop
      ? `cortex://oauth/mail?connected=1&email=${encodeURIComponent(email)}`
      : `${frontend}/?mail_connected=1&email=${encodeURIComponent(email)}`;
    const err = (msg: string) => isDesktop
      ? `cortex://oauth/mail?error=${encodeURIComponent(msg)}`
      : `${frontend}/?mail_error=${encodeURIComponent(msg)}`;

    try {
      if (typeof req.query.error === "string") { res.redirect(err(req.query.error)); return; }
      if (typeof code !== "string") { res.redirect(err("missing_code")); return; }

      const { userId } = verifyMailOAuthState(stateParam);
      const auth = createOAuth2Client();
      const { tokens } = await auth.getToken(code);
      auth.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: "v2", auth });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      if (!email) { res.redirect(err("no_email_returned")); return; }

      await upsertGmailAccount(userId, email, tokens, { label: email });

      res.redirect(ok(email));
    } catch {
      res.redirect(err("oauth_failed"));
    }
    return;
  }

  // ── Single Gmail flow (original) ──────────────────────────────────────────
  const resolveDesktop = (state: string): boolean => {
    try { return verifyGmailOAuthState(state).desktop; } catch { return false; }
  };
  const isDesktop = frontend.startsWith("cortex://") || resolveDesktop(stateParam);
  const ok  = isDesktop ? "cortex://oauth/google?connected=1" : `${frontend}/?gmail_connected=1`;
  const err = (msg: string) =>
    isDesktop ? `cortex://oauth/google?error=${encodeURIComponent(msg)}` : `${frontend}/?gmail_error=${encodeURIComponent(msg)}`;

  try {
    if (typeof req.query.error === "string") { res.redirect(err(req.query.error)); return; }
    if (typeof code !== "string") { res.redirect(err("missing_code")); return; }
    const { userId } = verifyGmailOAuthState(stateParam);
    const tokens = await exchangeAuthorizationCode(code);
    await saveGoogleCredentials(userId, tokens);
    res.redirect(ok);
  } catch {
    res.redirect(err("oauth_failed"));
  }
});

cortexGmailRouter.get("/inbox", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  if (!isGmailConfigured()) {
    sendSuccess(res, {
      configured: false,
      connected: false,
      messages: [] as never[],
      query: ""
    });
    return;
  }
  const input = inboxQuerySchema.parse(req.query);
  const result = await listInbox(req.auth!.userId, input.maxResults, input.q);
  sendSuccess(
    res,
    {
      configured: true,
      ...result,
      query: input.q
    },
    result.connected ? "live" : "mock"
  );
});

cortexGmailRouter.post("/messages/archive", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isGmailConfigured()) throw new HttpError(503, "Gmail OAuth not configured");
  const body = messageIdBodySchema.parse(req.body);
  await modifyMessageLabels(req.auth!.userId, body.messageId, { removeLabelIds: ["INBOX"] });
  sendSuccess(res, { messageId: body.messageId, action: "archived" }, "live");
});

cortexGmailRouter.post("/messages/mark-read", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isGmailConfigured()) throw new HttpError(503, "Gmail OAuth not configured");
  const body = messageIdBodySchema.parse(req.body);
  await modifyMessageLabels(req.auth!.userId, body.messageId, { removeLabelIds: ["UNREAD"] });
  sendSuccess(res, { messageId: body.messageId, action: "read" }, "live");
});

cortexGmailRouter.post("/messages/star", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  if (!isGmailConfigured()) throw new HttpError(503, "Gmail OAuth not configured");
  const body = messageIdBodySchema.extend({ starred: z.boolean() }).parse(req.body);
  await modifyMessageLabels(req.auth!.userId, body.messageId, {
    addLabelIds: body.starred ? ["STARRED"] : undefined,
    removeLabelIds: body.starred ? undefined : ["STARRED"]
  });
  sendSuccess(res, { messageId: body.messageId, action: body.starred ? "starred" : "unstarred" }, "live");
});

cortexGmailRouter.post("/disconnect", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  await clearGoogleCredentials(req.auth!.userId);
  sendSuccess(res, { disconnected: true });
});
