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
  exchangeAuthorizationCode,
  isGmailConfigured,
  listInbox,
  modifyMessageLabels
} from "../../features/gmail/gmail-service.js";
import { saveGoogleCredentials, getGoogleCredentials, clearGoogleCredentials } from "../../features/gmail/google-token-store.js";

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
  const state = signGmailOAuthState(req.auth!.userId);
  const url = buildGmailAuthUrl(state);
  sendSuccess(res, { url }, "live");
});

cortexGmailRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  try {
    if (typeof req.query.error === "string") {
      res.redirect(`${frontend}/?gmail_error=${encodeURIComponent(req.query.error)}`);
      return;
    }
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string" || typeof state !== "string") {
      res.redirect(`${frontend}/?gmail_error=missing_code`);
      return;
    }
    const { userId } = verifyGmailOAuthState(state);
    const tokens = await exchangeAuthorizationCode(code);
    await saveGoogleCredentials(userId, tokens);
    res.redirect(`${frontend}/?gmail_connected=1`);
  } catch {
    res.redirect(`${frontend}/?gmail_error=oauth_failed`);
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
