import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { readCanvasImage, saveCanvasImageFromDataUrl } from "../../features/canvas/canvas-assets.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";

const uploadSchema = z.object({
  dataUrl: z.string().min(32).max(12_000_000),
});

export const cortexCanvasRouter = Router();
cortexCanvasRouter.use(requireAuth);

/** POST /api/canvas/images — persist a canvas image for cross-device dashboard sync */
cortexCanvasRouter.post("/images", routeRateLimit(20, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const { dataUrl } = uploadSchema.parse(req.body);
  const { assetId, mime } = await saveCanvasImageFromDataUrl(userId, dataUrl);
  const imageUrl = `/api/canvas/images/${assetId}`;
  sendSuccess(res, { assetId, mime, imageUrl });
});

/** GET /api/canvas/images/:assetId — serve a user-owned canvas image */
cortexCanvasRouter.get("/images/:assetId", routeRateLimit(120, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const assetId = z.string().uuid().parse(req.params.assetId);
  const file = await readCanvasImage(userId, assetId);
  if (!file) throw new HttpError(404, "Image not found");
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.type(file.mime);
  res.send(file.buffer);
});
