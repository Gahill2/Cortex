import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { HttpError } from "../../utils/http-error.js";
import { isN8nConfigured, triggerN8nWebhook } from "../../features/n8n/n8n-client.js";

const triggerSchema = z.object({
  event: z.string().min(1).max(120),
  data: z.record(z.string(), z.unknown()).optional().default({}),
  webhookUrl: z.string().url().optional()
});

export const cortexN8nRouter = Router();

cortexN8nRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), (_req, res) => {
  res.json({ ok: true, configured: isN8nConfigured() });
});

/** Forward an event to your n8n Webhook workflow (authenticated). */
cortexN8nRouter.post("/trigger", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  const input = triggerSchema.parse(req.body ?? {});
  const result = await triggerN8nWebhook(
    { event: input.event, data: input.data },
    input.webhookUrl
  );
  if (!result.ok) {
    throw new HttpError(502, result.error ?? `n8n webhook failed (${result.status ?? "unknown"})`);
  }
  res.json({ ok: true, status: result.status ?? 200 });
});
