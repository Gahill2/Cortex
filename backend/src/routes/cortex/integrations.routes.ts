import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getIntegrationsStatus } from "../../features/integrations/status.js";
import { searchNotionPages } from "../../features/notion/notion-service.js";
import { notionSearchQuerySchema } from "../../schemas/query-schemas.js";

export const cortexIntegrationsRouter = Router();

cortexIntegrationsRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const items = await getIntegrationsStatus(req.auth?.userId);
  sendSuccess(res, { items });
});

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
