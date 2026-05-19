import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { isGmailConfigured, buildGmailAuthUrl } from "../../features/gmail/gmail-service.js";
import { signMailOAuthState } from "../../features/mail/mail-oauth-state.js";
import { signGmailOAuthState } from "../../features/gmail/gmail-state.js";
import {
  getMailAccountTokens,
  listMailAccounts,
  removeMailAccount
} from "../../features/mail/mail-account-store.js";
import { organizeInbox } from "../../features/mail/mail-organize.js";
import {
  getHubMessage,
  listAccountInbox,
  listUnifiedInbox,
  patchHubMessage
} from "../../features/mail/mail-hub.js";
import {
  applyCleanupActions,
  applyMailboxOrganize,
  scanMailCleanup
} from "../../features/mail/mail-cleanup.js";

const inboxQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
  unified: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  maxResults: z.coerce.number().int().min(1).max(100).optional().default(40),
  q: z.string().max(500).optional()
});

const messagePatchSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional()
});

const organizeBodySchema = z.object({
  accountId: z.string().min(1).optional(),
  applyToMailbox: z.boolean().optional().default(false)
});

const cleanupScanSchema = z.object({
  accountId: z.string().min(1).optional(),
  maxMessages: z.coerce.number().int().min(10).max(500).optional().default(200),
  query: z.string().max(500).optional().default("in:inbox")
});

const cleanupApplySchema = z.object({
  items: z
    .array(
      z.object({
        accountId: z.string().min(1),
        messageId: z.string().min(1),
        action: z.enum(["delete", "archive"])
      })
    )
    .min(1)
    .max(100)
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
  sendSuccess(res, { accounts }, "live");
});

const mailConnectBodySchema = z.object({
  desktop: z.boolean().optional(),
  returnOrigin: z.string().max(500).optional()
});

cortexMailRouter.post("/accounts/gmail/connect", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isGmailConfigured()) {
    throw new HttpError(503, "Gmail OAuth not configured on the server.");
  }
  const body = mailConnectBodySchema.parse(req.body ?? {});
  const state = signMailOAuthState(req.auth!.userId, {
    desktop: body.desktop === true,
    returnOrigin: body.returnOrigin
  });
  sendSuccess(res, { url: buildGmailAuthUrl(state) }, "live");
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
  const userId = req.auth!.userId;

  if (input.unified || !input.accountId) {
    const { messages } = await listUnifiedInbox(userId, input.maxResults, input.q);
    sendSuccess(res, { connected: messages.length > 0, messages, unified: true }, "live");
    return;
  }

  const result = await listAccountInbox(userId, input.accountId, input.maxResults, input.q);
  sendSuccess(res, { ...result, unified: false, query: input.q ?? "in:inbox" }, "live");
});

cortexMailRouter.get("/message/:accountId/:messageId", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.accountId);
  const messageId = z.string().min(1).parse(req.params.messageId);
  const msg = await getHubMessage(req.auth!.userId, accountId, messageId);
  if (!msg) throw new HttpError(404, "Message not found");
  sendSuccess(res, msg, "live");
});

cortexMailRouter.patch("/message/:accountId/:messageId", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.accountId);
  const messageId = z.string().min(1).parse(req.params.messageId);
  const patch = messagePatchSchema.parse(req.body ?? {});
  if (patch.read !== true && patch.archived !== true) {
    throw new HttpError(400, "Specify read and/or archived");
  }
  await patchHubMessage(req.auth!.userId, accountId, messageId, patch);
  sendSuccess(res, { messageId, ...patch }, "live");
});

cortexMailRouter.post("/organize", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  const body = organizeBodySchema.parse(req.body ?? {});
  const triage = await organizeInbox(req.auth!.userId, body.accountId);
  let mailbox = { archived: 0, markedRead: 0, categorized: 0 };
  if (body.applyToMailbox) {
    mailbox = await applyMailboxOrganize(req.auth!.userId, body.accountId);
  }
  sendSuccess(res, { ...triage, mailbox }, "live");
});

cortexMailRouter.post("/organize/apply", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  const body = z.object({ accountId: z.string().min(1).optional() }).parse(req.body ?? {});
  const result = await applyMailboxOrganize(req.auth!.userId, body.accountId);
  sendSuccess(res, result, "live");
});

cortexMailRouter.post("/cleanup/scan", requireAuth, routeRateLimit(3, 60_000), async (req, res) => {
  const body = cleanupScanSchema.parse(req.body ?? {});
  const result = await scanMailCleanup(req.auth!.userId, body);
  sendSuccess(res, result, "live");
});

cortexMailRouter.post("/cleanup/apply", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const body = cleanupApplySchema.parse(req.body ?? {});
  const result = await applyCleanupActions(req.auth!.userId, body.items);
  sendSuccess(res, result, "live");
});

cortexMailRouter.post("/messages/archive", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  const body = z
    .object({ messageId: z.string().min(1), accountId: z.string().min(1).optional() })
    .parse(req.body);
  const account = await getMailAccountTokens(req.auth!.userId, body.accountId);
  if (!account) throw new HttpError(503, "No mail account connected");
  await patchHubMessage(req.auth!.userId, account.accountId, body.messageId, { archived: true });
  sendSuccess(res, { messageId: body.messageId, action: "archived" }, "live");
});

cortexMailRouter.post("/messages/mark-read", requireAuth, routeRateLimit(40, 60_000), async (req, res) => {
  const body = z
    .object({ messageId: z.string().min(1), accountId: z.string().min(1).optional() })
    .parse(req.body);
  const account = await getMailAccountTokens(req.auth!.userId, body.accountId);
  if (!account) throw new HttpError(503, "No mail account connected");
  await patchHubMessage(req.auth!.userId, account.accountId, body.messageId, { read: true });
  sendSuccess(res, { messageId: body.messageId, action: "read" }, "live");
});

cortexMailRouter.delete("/accounts/:accountId", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.accountId);
  await removeMailAccount(req.auth!.userId, accountId);
  sendSuccess(res, { disconnected: true }, "live");
});

cortexMailRouter.post("/accounts/:accountId/disconnect", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.accountId);
  await removeMailAccount(req.auth!.userId, accountId);
  sendSuccess(res, { disconnected: true }, "live");
});
