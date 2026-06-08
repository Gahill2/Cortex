import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { getIntegrationsStatus } from "../../features/integrations/status.js";
import {
  deleteIntegrationOAuth,
  getIntegrationOAuthSetup,
  saveIntegrationOAuth,
  type IntegrationOAuthProvider,
} from "../../features/integrations/oauth-config.js";
import { searchNotionPages } from "../../features/notion/notion-service.js";
import { notionSearchQuerySchema } from "../../schemas/query-schemas.js";

export const cortexIntegrationsRouter = Router();

const oauthProviderSchema = z.enum(["google", "microsoft", "spotify", "linkedin", "notion"]);

const saveOAuthSchema = z.object({
  clientId: z.string().min(4).max(500),
  clientSecret: z.string().min(4).max(500),
});

cortexIntegrationsRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const items = await getIntegrationsStatus(req.auth?.userId);
  sendSuccess(res, { items });
});

/** Redirect URIs + console links — no manual REDIRECT_URI env needed. */
cortexIntegrationsRouter.get("/oauth-setup", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const returnOrigin =
    typeof req.query.returnOrigin === "string" ? req.query.returnOrigin : undefined;
  const providers = await getIntegrationOAuthSetup(returnOrigin);
  sendSuccess(res, {
    providers,
    hint:
      "OAuth requires a one-time app per provider (Google, LinkedIn, etc.). Paste Client ID + Secret here — Cortex stores them encrypted. Redirect URLs are filled in automatically.",
  });
});

/** Save OAuth app credentials from Settings (alternative to api.env). */
cortexIntegrationsRouter.put(
  "/oauth-apps/:provider",
  requireAuth,
  routeRateLimit(10, 60_000),
  async (req, res) => {
    const provider = oauthProviderSchema.parse(req.params.provider) as IntegrationOAuthProvider;
    const body = saveOAuthSchema.parse(req.body ?? {});
    await saveIntegrationOAuth(provider, body.clientId, body.clientSecret);
    const setup = await getIntegrationOAuthSetup(
      typeof req.body?.returnOrigin === "string" ? req.body.returnOrigin : undefined
    );
    const item = setup.find((p) => p.id === provider);
    sendSuccess(res, { provider, ready: item?.ready ?? true });
  }
);

cortexIntegrationsRouter.delete(
  "/oauth-apps/:provider",
  requireAuth,
  routeRateLimit(10, 60_000),
  async (req, res) => {
    const provider = oauthProviderSchema.parse(req.params.provider) as IntegrationOAuthProvider;
    await deleteIntegrationOAuth(provider);
    sendSuccess(res, { provider, removed: true });
  }
);

cortexIntegrationsRouter.get(
  "/notion/search",
  requireAuth,
  routeRateLimit(20, 60_000),
  async (req, res) => {
    const { q } = notionSearchQuerySchema.parse(req.query);
    const result = await searchNotionPages(q);
    if (!result.ok) {
      sendSuccess(res, { results: [], error: result.error });
      return;
    }
    sendSuccess(res, { results: result.results ?? [] });
  }
);
