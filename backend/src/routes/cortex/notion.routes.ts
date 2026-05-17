import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { isNotionConfigured, searchNotionPages, testNotionConnection } from "../../features/notion/notion-service.js";

export const cortexNotionRouter = Router();

cortexNotionRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (_req, res) => {
  const configured = isNotionConfigured();
  if (!configured) {
    sendSuccess(res, { configured: false, connected: false });
    return;
  }
  const test = await testNotionConnection();
  sendSuccess(res, {
    configured: true,
    connected: test.ok,
    workspace: test.name,
    error: test.error
  });
});

cortexNotionRouter.get("/pages", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const result = await searchNotionPages(q);
  sendSuccess(res, { pages: result.results ?? [], error: result.error });
});
