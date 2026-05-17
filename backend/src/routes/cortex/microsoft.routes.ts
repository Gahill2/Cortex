import { Router } from "express";
import { env } from "../../config/env.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { prisma } from "../../db/prisma.js";
import { listMailAccounts } from "../../features/mail/mail-account-store.js";
import { signMicrosoftState, verifyMicrosoftState } from "../../features/microsoft/microsoft-state.js";
import {
  isMicrosoftConfigured,
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  saveMicrosoftTokens,
  getMicrosoftUserEmail,
} from "../../features/microsoft/microsoft-service.js";

export const cortexMicrosoftRouter = Router();

// ── Connect (get OAuth URL) ───────────────────────────────────────────────────
cortexMicrosoftRouter.post("/connect", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isMicrosoftConfigured()) {
    throw new HttpError(503, "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.");
  }
  const isDesktop = req.body?.desktop === true;
  const state = signMicrosoftState(req.auth!.userId, isDesktop);
  const url = buildMicrosoftAuthUrl(state);
  sendSuccess(res, { url });
});

// ── OAuth callback ────────────────────────────────────────────────────────────
cortexMicrosoftRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";

  let isDesktop = frontend.startsWith("cortex://");
  try {
    const { desktop } = verifyMicrosoftState(stateParam);
    isDesktop = isDesktop || desktop;
  } catch { /* ignore */ }

  const ok = (email: string) => isDesktop
    ? `cortex://oauth/microsoft?connected=1&email=${encodeURIComponent(email)}`
    : `${frontend}/?microsoft_connected=1&email=${encodeURIComponent(email)}`;
  const err = (msg: string) => isDesktop
    ? `cortex://oauth/microsoft?error=${encodeURIComponent(msg)}`
    : `${frontend}/?microsoft_error=${encodeURIComponent(msg)}`;

  try {
    if (typeof req.query.error === "string") { res.redirect(err(req.query.error)); return; }
    const code = req.query.code;
    if (typeof code !== "string") { res.redirect(err("missing_code")); return; }

    const { userId } = verifyMicrosoftState(stateParam);
    const tokens = await exchangeMicrosoftCode(code);

    // Get the user's email from Microsoft Graph
    const email = await getMicrosoftUserEmail(tokens.access_token);
    if (!email) { res.redirect(err("no_email_returned")); return; }

    await saveMicrosoftTokens(userId, email, tokens);
    const existing = await listMailAccounts(userId);
    await prisma.mailAccount.upsert({
      where: { userId_provider_email: { userId, provider: "microsoft", email: email.toLowerCase() } },
      update: { label: email },
      create: {
        userId,
        provider: "microsoft",
        label: email,
        email: email.toLowerCase(),
        isPrimary: existing.length === 0
      }
    });

    res.redirect(ok(email));
  } catch (e) {
    console.error("[microsoft] oauth callback error:", e);
    res.redirect(err("oauth_failed"));
  }
});
