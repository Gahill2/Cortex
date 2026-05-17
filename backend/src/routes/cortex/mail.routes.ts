import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { isGmailConfigured, listInbox, modifyMessageLabels } from "../../features/gmail/gmail-service.js";
import {
  getMailAccountTokens,
  listMailAccounts,
  removeMailAccount
} from "../../features/mail/mail-account-store.js";
import { organizeInbox } from "../../features/mail/mail-organize.js";
import { buildGmailAuthUrl } from "../../features/gmail/gmail-service.js";
import { signGmailOAuthState } from "../../features/gmail/gmail-state.js";

const inboxQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
  maxResults: z.coerce.number().int().min(1).max(50).optional().default(30),
  q: z.string().max(500).optional().default("in:inbox")
});

const messageIdBodySchema = z.object({
  messageId: z.string().min(1),
  accountId: z.string().min(1).optional()
});

const organizeBodySchema = z.object({
  accountId: z.string().min(1).optional()
});

export const cortexMailRouter = Router();

cortexMailRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const accounts = await listMailAccounts(req.auth!.userId);
  sendSuccess(res, {
    configured: isGmailConfigured(),
    connected: accounts.length > 0,
    accountCount: accounts.length
  });
});

cortexMailRouter.get("/accounts", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const accounts = await listMailAccounts(req.auth!.userId);
  sendSuccess(res, { accounts });
});

cortexMailRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isGmailConfigured()) {
    throw new HttpError(503, "Gmail OAuth not configured on the server.");
  }
  const state = signGmailOAuthState(req.auth!.userId);
  sendSuccess(res, { url: buildGmailAuthUrl(state) });
});

cortexMailRouter.get("/inbox", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  const input = inboxQuerySchema.parse(req.query);
  const account = await getMailAccountTokens(req.auth!.userId, input.accountId);
  if (!account) {
    sendSuccess(res, { connected: false, messages: [], accountId: null });
    return;
  }
  const result = await listInbox(req.auth!.userId, input.maxResults, input.q, account.tokens);
  sendSuccess(res, { ...result, accountId: account.accountId, query: input.q });
});

cortexMailRouter.post("/organize", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  const body = organizeBodySchema.parse(req.body ?? {});
  const result = await organizeInbox(req.auth!.userId, body.accountId);
  sendSuccess(res, result);
});

cortexMailRouter.post("/messages/archive", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  const body = messageIdBodySchema.parse(req.body);
  const account = await getMailAccountTokens(req.auth!.userId, body.accountId);
  if (!account) throw new HttpError(503, "No mail account connected");
  await modifyMessageLabels(
    req.auth!.userId,
    body.messageId,
    { removeLabelIds: ["INBOX"] },
    account.tokens
  );
  sendSuccess(res, { messageId: body.messageId, action: "archived" });
});

cortexMailRouter.post("/messages/mark-read", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  const body = messageIdBodySchema.parse(req.body);
  const account = await getMailAccountTokens(req.auth!.userId, body.accountId);
  if (!account) throw new HttpError(503, "No mail account connected");
  await modifyMessageLabels(
    req.auth!.userId,
    body.messageId,
    { removeLabelIds: ["UNREAD"] },
    account.tokens
  );
  sendSuccess(res, { messageId: body.messageId, action: "read" });
});

cortexMailRouter.post("/accounts/:accountId/disconnect", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.accountId);
  await removeMailAccount(req.auth!.userId, accountId);
  sendSuccess(res, { disconnected: true });
});
