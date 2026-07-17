import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import {
  dateQuerySchema,
  dateRangeQuerySchema,
  estimateRequestSchema,
  nutritionTargetsSchema,
  saveEntrySchema,
  updateEntrySchema,
} from "../../features/nutrition/nutrition-schemas.js";
import {
  estimateMealNutrition,
  getNutritionAIStatus,
} from "../../features/nutrition/nutrition-ai-provider.js";
import {
  entriesToCsv,
  getEntry,
  getNutritionTargets,
  getTotalsForDate,
  getWeeklyAverages,
  listEntries,
  serializeEntry,
  updateNutritionTargets,
} from "../../features/nutrition/nutrition-service.js";

export const cortexNutritionRouter = Router();
cortexNutritionRouter.use(requireAuth);

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseConsumedAt(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "invalid_consumed_at");
  return d;
}

/** GET /api/nutrition/status — AI integration health */
cortexNutritionRouter.get("/status", routeRateLimit(30, 60_000), (_req, res) => {
  sendSuccess(res, getNutritionAIStatus(), "live");
});

/** POST /api/nutrition/estimate */
cortexNutritionRouter.post("/estimate", routeRateLimit(20, 60_000), async (req, res) => {
  const input = estimateRequestSchema.parse(req.body);
  try {
    const estimate = await estimateMealNutrition(input.mealDescription, input.consumedAt);
    const { aiProvider, aiModel, ...payload } = estimate;
    sendSuccess(
      res,
      {
        ...payload,
        aiProvider,
        aiModel,
      },
      getNutritionAIStatus().mockMode ? "mock" : "live"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nutrition estimate failed";
    if (/timeout/i.test(message)) {
      throw new HttpError(504, "Nutrition AI request timed out");
    }
    if (/not configured/i.test(message)) {
      throw new HttpError(503, message);
    }
    throw new HttpError(502, "Nutrition AI could not produce a valid estimate");
  }
});

/** POST /api/nutrition/entries */
cortexNutritionRouter.post("/entries", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const input = saveEntrySchema.parse(req.body);

  const row = await prisma.nutritionEntry.create({
    data: {
      userId,
      consumedAt: parseConsumedAt(input.consumedAt),
      originalDescription: input.originalDescription,
      normalizedDescription: input.normalizedDescription,
      mealType: input.mealType,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      fiberG: input.fiberG ?? null,
      sugarG: input.sugarG ?? null,
      sodiumMg: input.sodiumMg ?? null,
      confidence: input.confidence,
      assumptions: JSON.stringify(input.assumptions),
      sourceType: input.sourceType,
      aiProvider: input.aiProvider ?? null,
      aiModel: input.aiModel ?? null,
      userEdited: input.userEdited ?? false,
    },
  });

  sendSuccess(res, serializeEntry(row), "live");
});

/** GET /api/nutrition/entries?from=&to= */
cortexNutritionRouter.get("/entries", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const { from, to } = dateRangeQuerySchema.parse(req.query);
  const rows = await listEntries(userId, from, to);
  sendSuccess(res, rows.map(serializeEntry), "live");
});

/** GET /api/nutrition/entries/:id */
cortexNutritionRouter.get("/entries/:id", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);
  const row = await getEntry(userId, id);
  if (!row) throw new HttpError(404, "Nutrition entry not found");
  sendSuccess(res, serializeEntry(row), "live");
});

/** PATCH /api/nutrition/entries/:id */
cortexNutritionRouter.patch("/entries/:id", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);
  const existing = await getEntry(userId, id);
  if (!existing) throw new HttpError(404, "Nutrition entry not found");

  const input = updateEntrySchema.parse(req.body);
  const row = await prisma.nutritionEntry.update({
    where: { id: existing.id },
    data: {
      ...(input.originalDescription !== undefined ? { originalDescription: input.originalDescription } : {}),
      ...(input.normalizedDescription !== undefined ? { normalizedDescription: input.normalizedDescription } : {}),
      ...(input.mealType !== undefined ? { mealType: input.mealType } : {}),
      ...(input.consumedAt !== undefined ? { consumedAt: parseConsumedAt(input.consumedAt) } : {}),
      ...(input.calories !== undefined ? { calories: input.calories } : {}),
      ...(input.proteinG !== undefined ? { proteinG: input.proteinG } : {}),
      ...(input.carbsG !== undefined ? { carbsG: input.carbsG } : {}),
      ...(input.fatG !== undefined ? { fatG: input.fatG } : {}),
      ...(input.fiberG !== undefined ? { fiberG: input.fiberG } : {}),
      ...(input.sugarG !== undefined ? { sugarG: input.sugarG } : {}),
      ...(input.sodiumMg !== undefined ? { sodiumMg: input.sodiumMg } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.assumptions !== undefined ? { assumptions: JSON.stringify(input.assumptions) } : {}),
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      userEdited: true,
    },
  });

  sendSuccess(res, serializeEntry(row), "live");
});

/** DELETE /api/nutrition/entries/:id */
cortexNutritionRouter.delete("/entries/:id", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const id = String(req.params.id);
  const existing = await getEntry(userId, id);
  if (!existing) throw new HttpError(404, "Nutrition entry not found");
  await prisma.nutritionEntry.delete({ where: { id: existing.id } });
  sendSuccess(res, { ok: true, id: existing.id }, "live");
});

/** GET /api/nutrition/totals/today */
cortexNutritionRouter.get("/totals/today", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const totals = await getTotalsForDate(userId, todayUtcDate());
  sendSuccess(res, { date: todayUtcDate(), totals }, "live");
});

/** GET /api/nutrition/totals?date=YYYY-MM-DD */
cortexNutritionRouter.get("/totals", routeRateLimit(60, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const { date } = dateQuerySchema.parse(req.query);
  const targetDate = date ?? todayUtcDate();
  const totals = await getTotalsForDate(userId, targetDate);
  sendSuccess(res, { date: targetDate, totals }, "live");
});

/** GET /api/nutrition/totals/weekly?endDate=YYYY-MM-DD */
cortexNutritionRouter.get("/totals/weekly", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const endDate = z
    .object({ endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
    .parse(req.query).endDate ?? todayUtcDate();
  const weekly = await getWeeklyAverages(userId, endDate);
  sendSuccess(res, weekly, "live");
});

/** GET /api/nutrition/targets */
cortexNutritionRouter.get("/targets", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const targets = await getNutritionTargets(userId);
  sendSuccess(res, targets, "live");
});

/** PATCH /api/nutrition/targets */
cortexNutritionRouter.patch("/targets", routeRateLimit(30, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const patch = nutritionTargetsSchema.parse(req.body);
  const targets = await updateNutritionTargets(userId, patch);
  sendSuccess(res, targets, "live");
});

/** GET /api/nutrition/export?from=&to= */
cortexNutritionRouter.get("/export", routeRateLimit(10, 60_000), async (req, res) => {
  const { userId } = req.auth!;
  const { from, to } = dateRangeQuerySchema.parse(req.query);
  const rows = await listEntries(userId, from, to);
  const csv = entriesToCsv(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="nutrition-log-${from}-to-${to}.csv"`);
  res.send(csv);
});
