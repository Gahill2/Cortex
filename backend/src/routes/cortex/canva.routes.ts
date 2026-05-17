import { Router } from "express";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import {
  buildCanvaAuthorizeUrl,
  exchangeCanvaAuthorizationCode,
  isCanvaAppsSdkEnvPresent,
  isCanvaConnectAuthorizeReady,
} from "../../features/canva/canva-service.js";
import { takeCanvaPkceSession } from "../../features/canva/canva-pkce-session.js";
import {
  clearCanvaTokens,
  isCanvaConnected,
  saveCanvaTokens,
} from "../../features/canva/canva-token-store.js";

export const cortexCanvaRouter = Router();

cortexCanvaRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const connect_ready = isCanvaConnectAuthorizeReady();
  const connected = connect_ready && (await isCanvaConnected(userId));
  sendSuccess(
    res,
    {
      apps_sdk: {
        app_id_configured: env.CANVA_APP_ID.trim().length > 0,
        app_origin_configured: env.CANVA_APP_ORIGIN.trim().length > 0,
        hmr_enabled: /^true$/i.test(env.CANVA_HMR_ENABLED.trim()),
      },
      connect: {
        client_id_configured: env.CANVA_CLIENT_ID.trim().length > 0,
        client_secret_configured: env.CANVA_CLIENT_SECRET.trim().length > 0,
        redirect_uri_configured: env.CANVA_REDIRECT_URI.trim().length > 0,
        /** True when Cortex can run the full Connect OAuth + token exchange. */
        oauth_exchange_ready: connect_ready,
        connected,
      },
      /** Register this exact URL under Connect → Authentication → Redirect URLs. */
      redirect_uri_to_register: env.CANVA_REDIRECT_URI.trim() || null,
    },
    "live"
  );
});

cortexCanvaRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isCanvaConnectAuthorizeReady()) {
    throw new HttpError(
      503,
      "Canva Connect is not ready. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI on the API server (see docs/canva.md)."
    );
  }
  const { url } = buildCanvaAuthorizeUrl(req.auth!.userId);
  sendSuccess(res, { url }, "live");
});

cortexCanvaRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  const base = `${frontend.replace(/\/$/, "")}/settings`;

  if (typeof req.query.error === "string") {
    res.redirect(`${base}?canva_oauth_error=${encodeURIComponent(req.query.error)}`);
    return;
  }

  const code = req.query.code;
  const state = req.query.state;
  if (typeof code !== "string" || typeof state !== "string") {
    res.redirect(`${base}?canva_oauth_error=missing_code_or_state`);
    return;
  }

  const session = takeCanvaPkceSession(state);
  if (!session) {
    res.redirect(`${base}?canva_oauth_error=invalid_or_expired_state`);
    return;
  }

  if (!isCanvaConnectAuthorizeReady()) {
    res.redirect(`${base}?canva_oauth_error=server_not_configured`);
    return;
  }

  try {
    const tokens = await exchangeCanvaAuthorizationCode(code, session.codeVerifier);
    await saveCanvaTokens(session.userId, tokens);
    res.redirect(`${base}?canva_oauth=connected`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed";
    res.redirect(`${base}?canva_oauth_error=${encodeURIComponent(msg)}`);
  }
});

cortexCanvaRouter.post("/disconnect", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  await clearCanvaTokens(req.auth!.userId);
  sendSuccess(res, { connected: false }, "live");
});

/** Optional: dev-only sanity check that `.env` Canva keys load (no values returned). */
cortexCanvaRouter.get("/health-env", routeRateLimit(30, 60_000), (_req, res) => {
  sendSuccess(
    res,
    {
      canva_apps_sdk_env: isCanvaAppsSdkEnvPresent(),
      canva_connect_oauth_ready: isCanvaConnectAuthorizeReady(),
    },
    "live"
  );
});
