import { Router } from "express";
import { z } from "zod";
import { resolveIntegrationOAuth } from "../../features/integrations/oauth-config.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { signLinkedInOAuthState, verifyLinkedInOAuthState } from "../../features/linkedin/linkedin-state.js";
import {
  buildLinkedInAuthUrl,
  exchangeLinkedInCode,
  fetchLinkedInProfile,
  isLinkedInConfigured,
} from "../../features/linkedin/linkedin-service.js";
import {
  clearLinkedInTokens,
  isLinkedInConnected,
  saveLinkedInTokens,
} from "../../features/linkedin/linkedin-token-store.js";
import { oauthCallbackQuerySchema } from "../../schemas/query-schemas.js";

export const cortexLinkedInRouter = Router();

cortexLinkedInRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const configured = await isLinkedInConfigured();
  const connected = configured && (await isLinkedInConnected(req.auth!.userId));
  let profile: Awaited<ReturnType<typeof fetchLinkedInProfile>> = null;
  if (connected) {
    profile = await fetchLinkedInProfile(req.auth!.userId);
  }
  sendSuccess(res, {
    configured,
    connected,
    profile,
    redirectUri: configured ? (await resolveIntegrationOAuth("linkedin"))?.redirectUri ?? null : null,
  });
});

cortexLinkedInRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!(await isLinkedInConfigured())) {
    throw new HttpError(
      503,
      "LinkedIn is not enabled yet. Add OAuth credentials in Settings → Integrations (takes ~2 minutes)."
    );
  }
  const state = signLinkedInOAuthState(req.auth!.userId);
  sendSuccess(res, { url: await buildLinkedInAuthUrl(state) });
});

cortexLinkedInRouter.post("/oauth/exchange", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const { code, state } = z
    .object({
      code: z.string().min(1),
      state: z.string().min(1),
    })
    .parse(req.body);
  const { userId } = verifyLinkedInOAuthState(state);
  if (userId !== req.auth!.userId) throw new HttpError(403, "State userId mismatch");
  const tokens = await exchangeLinkedInCode(code);
  await saveLinkedInTokens(userId, tokens);
  sendSuccess(res, { connected: true });
});

cortexLinkedInRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const { env } = await import("../../config/env.js");
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  try {
    const query = oauthCallbackQuerySchema.parse(req.query);
    if (query.error) {
      res.redirect(`${frontend}/?linkedin_error=${encodeURIComponent(query.error)}`);
      return;
    }
    const { code, state } = query;
    if (!code || !state) {
      res.redirect(`${frontend}/?linkedin_error=missing_code`);
      return;
    }
    const { userId } = verifyLinkedInOAuthState(state);
    const tokens = await exchangeLinkedInCode(code);
    await saveLinkedInTokens(userId, tokens);
    res.redirect(`${frontend}/?linkedin_connected=1`);
  } catch {
    res.redirect(`${frontend}/?linkedin_error=oauth_failed`);
  }
});

cortexLinkedInRouter.get("/profile", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!(await isLinkedInConfigured())) throw new HttpError(503, "LinkedIn not configured");
  if (!(await isLinkedInConnected(req.auth!.userId))) throw new HttpError(401, "LinkedIn not connected");
  const profile = await fetchLinkedInProfile(req.auth!.userId);
  sendSuccess(res, { profile });
});

cortexLinkedInRouter.post("/disconnect", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  await clearLinkedInTokens(req.auth!.userId);
  sendSuccess(res, { disconnected: true });
});
