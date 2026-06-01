import { Router } from "express";
import { z } from "zod";
import { resolveOAuthFrontendBase, resolveMicrosoftOAuthRedirectUri } from "../../features/oauth/oauth-frontend-redirect.js";
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

cortexMicrosoftRouter.get("/setup", requireAuth, routeRateLimit(30, 60_000), (_req, res) => {
  sendSuccess(res, {
    configured: isMicrosoftConfigured(),
    redirectUri: resolveMicrosoftOAuthRedirectUri(),
    docsPath: "docs/microsoft-oauth-homelab.md",
  });
});

// ── Connect (get OAuth URL) ───────────────────────────────────────────────────
cortexMicrosoftRouter.post("/connect", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isMicrosoftConfigured()) {
    throw new HttpError(503, "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.");
  }
  const body = z
    .object({
      desktop: z.boolean().optional(),
      returnOrigin: z.string().max(500).optional()
    })
    .parse(req.body ?? {});
  const state = signMicrosoftState(req.auth!.userId, {
    desktop: body.desktop === true,
    returnOrigin: body.returnOrigin
  });
  const url = buildMicrosoftAuthUrl(state, body.returnOrigin);
  sendSuccess(res, { url });
});

// ── OAuth callback ────────────────────────────────────────────────────────────
cortexMicrosoftRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";

  let msState: { userId: string; desktop: boolean; returnOrigin?: string };
  try {
    msState = verifyMicrosoftState(stateParam);
  } catch {
    const frontend = resolveOAuthFrontendBase();
    res.redirect(`${frontend}/?microsoft_error=oauth_failed`);
    return;
  }

  const frontend = resolveOAuthFrontendBase(msState.returnOrigin);
  const isDesktop = frontend.startsWith("cortex://") || msState.desktop;

  const ok = (email: string) =>
    isDesktop
      ? `cortex://oauth/microsoft?connected=1&email=${encodeURIComponent(email)}`
      : `${frontend}/?mail_connected=1&provider=microsoft&email=${encodeURIComponent(email)}`;
  const err = (msg: string) =>
    isDesktop
      ? `cortex://oauth/microsoft?error=${encodeURIComponent(msg)}`
      : `${frontend}/?mail_error=${encodeURIComponent(msg)}`;

  try {
    if (typeof req.query.error === "string") { res.redirect(err(req.query.error)); return; }
    const code = req.query.code;
    if (typeof code !== "string") { res.redirect(err("missing_code")); return; }

    const { userId } = msState;
    const tokens = await exchangeMicrosoftCode(code, msState.returnOrigin);

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
