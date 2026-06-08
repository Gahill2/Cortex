import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { settingsRepo } from "../../repositories/index.js";

const jsonObj = z.record(z.string(), z.unknown());

const patchSettingsSchema = z.object({
  appearance: z.enum(["light", "dark", "system"]).optional(),
  wallpaper: jsonObj.optional().nullable(),
  aiTheme: jsonObj.optional().nullable(),
  weatherCity: z.string().max(100).optional().nullable(),
  weatherUnits: z.enum(["metric", "imperial"]).optional(),
  homeGoals: z.array(z.unknown()).optional().nullable(),
  canvasLayout: jsonObj.optional().nullable(),
  extraJson: jsonObj.optional().nullable(),
});

const changePinSchema = z.object({
  currentPin: z.string().regex(/^\d{4,6}$/),
  newPin: z.string().regex(/^\d{4,6}$/),
});

export const cortexSettingsRouter = Router();
cortexSettingsRouter.use(requireAuth);

/** GET /api/settings — retrieve user preferences */
cortexSettingsRouter.get("/", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const settings = await settingsRepo.get(userId);

  if (!settings) {
    sendSuccess(res, {
      userId,
      appearance: "system",
      wallpaper: null,
      aiTheme: null,
      weatherCity: null,
      weatherUnits: "metric",
      homeGoals: null,
      canvasLayout: null,
      extraJson: null,
      updatedAt: null,
    });
    return;
  }

  const { pinHash: _pin, ...safe } = settings;
  sendSuccess(res, {
    ...safe,
    hasPinSet: Boolean(settings.pinHash),
    updatedAt: settings.updatedAt?.toISOString() ?? null,
  });
});

/** PATCH /api/settings — update user preferences (partial) */
cortexSettingsRouter.patch("/", routeRateLimit(120, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const input = patchSettingsSchema.parse(req.body);

  if (input.extraJson !== undefined && input.extraJson !== null) {
    const existing = await settingsRepo.get(userId);
    input.extraJson = {
      ...(existing?.extraJson ?? {}),
      ...input.extraJson,
    };
  }

  const updated = await settingsRepo.upsert(userId, input);
  const { pinHash: _pin, ...safe } = updated;
  sendSuccess(res, {
    ...safe,
    hasPinSet: Boolean(updated.pinHash),
    updatedAt: updated.updatedAt?.toISOString() ?? null,
  });
});

/** POST /api/settings/change-pin — update session PIN */
cortexSettingsRouter.post("/change-pin", routeRateLimit(5, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const { currentPin, newPin } = changePinSchema.parse(req.body);

  const settings = await settingsRepo.get(userId);
  if (settings?.pinHash) {
    const valid = await bcrypt.compare(currentPin, settings.pinHash);
    if (!valid) throw new HttpError(401, "Current PIN is incorrect");
  }

  const newHash = await bcrypt.hash(newPin, 10);
  await settingsRepo.upsert(userId, { pinHash: newHash });

  sendSuccess(res, { ok: true, message: "PIN updated successfully" });
});
