import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitBuckets } from "../middleware/rate-limit.js";
import { sessionLockStore } from "../features/auth/session-lock-store.js";
import {
  estimateMealNutrition,
  getNutritionAIStatus,
} from "../features/nutrition/nutrition-ai-provider.js";
import {
  estimateRequestSchema,
  nutritionEstimateSchema,
  extractJsonObject,
} from "../features/nutrition/nutrition-schemas.js";

let app: Express;
let authHeader: string;
const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET ??= "test-secret-for-cortex-auth-suite-12345";
  process.env.CORTEX_DEMO_USER_EMAIL ??= "grey@cortex.local";
  process.env.CORTEX_DEMO_USER_PASSWORD ??= "ChangeMe123!";
  process.env.CORTEX_DEMO_USER_PIN ??= "1234";
  process.env.NUTRITION_AI_MOCK = "true";
  process.env.NUTRITION_AI_PROVIDER = "mock";

  ({ app } = await import("../app.js"));

  const loginResponse = await request(app).post("/api/auth/login").send({
    email: process.env.CORTEX_DEMO_USER_EMAIL,
    password: process.env.CORTEX_DEMO_USER_PASSWORD,
  });
  authHeader = `Bearer ${loginResponse.body.token}`;
});

beforeEach(() => {
  resetRateLimitBuckets();
  sessionLockStore.clear();
  process.env.NUTRITION_AI_MOCK = "true";
  process.env.NUTRITION_AI_PROVIDER = "mock";
});

async function unlockSession(): Promise<void> {
  await request(app)
    .post("/api/auth/verify-pin")
    .set("authorization", authHeader)
    .send({ pin: process.env.CORTEX_DEMO_USER_PIN });
}

describe("nutrition schemas", () => {
  it("validates estimate request", () => {
    const parsed = estimateRequestSchema.parse({
      mealDescription: "  grilled chicken salad ",
      consumedAt: "2026-07-17T18:30:00-05:00",
    });
    expect(parsed.mealDescription).toBe("grilled chicken salad");
  });

  it("rejects malformed AI output", () => {
    expect(() =>
      nutritionEstimateSchema.parse({
        originalDescription: "x",
        normalizedDescription: "x",
        mealType: "lunch",
        calories: "not-a-number",
        proteinG: 10,
        carbsG: 10,
        fatG: 5,
        confidence: "medium",
        assumptions: ["a"],
        sourceType: "estimate",
      })
    ).toThrow();
  });

  it("parses JSON from fenced AI text", () => {
    const obj = extractJsonObject('```json\n{"calories": 100}\n```');
    expect(obj).toEqual({ calories: 100 });
  });
});

describe("nutrition AI provider", () => {
  it("returns mock estimate without paid API", async () => {
    const result = await estimateMealNutrition("Raising Cane's combo with fries");
    expect(result.calories).toBeGreaterThan(0);
    expect(result.aiProvider).toBe("mock");
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("reports mock mode in status", () => {
    const status = getNutritionAIStatus();
    expect(status.mockMode).toBe(true);
    expect(status.configured).toBe(true);
  });
});

describe("nutrition routes", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/nutrition/totals/today");
    expect(res.status).toBe(401);
  });

  it("estimates meal nutrition", async () => {
    await unlockSession();
    const res = await request(app)
      .post("/api/nutrition/estimate")
      .set("authorization", authHeader)
      .send({
        mealDescription: "Raising Cane's three-finger combo with fries and Diet Coke",
        consumedAt: "2026-07-17T18:30:00-05:00",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.calories).toBeGreaterThan(0);
    expect(res.body.data.confidence).toMatch(/low|medium|high/);
  });

  it("rejects invalid estimate payload", async () => {
    await unlockSession();
    const res = await request(app)
      .post("/api/nutrition/estimate")
      .set("authorization", authHeader)
      .send({ mealDescription: "" });

    expect(res.status).toBe(400);
  });

  it.skipIf(!hasDatabase)("saves, edits, deletes entry and computes totals", async () => {
    await unlockSession();
    const today = new Date().toISOString().slice(0, 10);

    const createRes = await request(app)
      .post("/api/nutrition/entries")
      .set("authorization", authHeader)
      .send({
        originalDescription: "Greek yogurt with berries",
        normalizedDescription: "1 cup Greek yogurt with mixed berries",
        mealType: "breakfast",
        consumedAt: `${today}T08:00:00.000Z`,
        calories: 220,
        proteinG: 18,
        carbsG: 22,
        fatG: 6,
        fiberG: 3,
        sugarG: 12,
        sodiumMg: 80,
        confidence: "medium",
        assumptions: ["Standard single-serving yogurt cup"],
        sourceType: "generic_food_estimate",
        aiProvider: "mock",
        aiModel: "mock-v1",
      });

    expect(createRes.status).toBe(200);
    const entryId = createRes.body.data.id as string;

    const patchRes = await request(app)
      .patch(`/api/nutrition/entries/${entryId}`)
      .set("authorization", authHeader)
      .send({ calories: 240 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.calories).toBe(240);
    expect(patchRes.body.data.userEdited).toBe(true);

    const totalsRes = await request(app)
      .get(`/api/nutrition/totals?date=${today}`)
      .set("authorization", authHeader);

    expect(totalsRes.status).toBe(200);
    expect(totalsRes.body.data.totals.calories).toBeGreaterThanOrEqual(240);

    const weeklyRes = await request(app)
      .get(`/api/nutrition/totals/weekly?endDate=${today}`)
      .set("authorization", authHeader);

    expect(weeklyRes.status).toBe(200);
    expect(weeklyRes.body.data.days).toHaveLength(7);
    expect(weeklyRes.body.data.averages.calories).toBeGreaterThanOrEqual(0);

    const deleteRes = await request(app)
      .delete(`/api/nutrition/entries/${entryId}`)
      .set("authorization", authHeader);

    expect(deleteRes.status).toBe(200);
  });

  it.skipIf(!hasDatabase)("updates daily macro targets", async () => {
    await unlockSession();
    const res = await request(app)
      .patch("/api/nutrition/targets")
      .set("authorization", authHeader)
      .send({ calorieTarget: 2100, proteinTargetG: 160 });

    expect(res.status).toBe(200);
    expect(res.body.data.calorieTarget).toBe(2100);
    expect(res.body.data.proteinTargetG).toBe(160);
  });

  it.skipIf(!hasDatabase)("exports CSV log", async () => {
    await unlockSession();
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/nutrition/export?from=${today}&to=${today}`)
      .set("authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text.split("\n")[0]).toContain("Original meal description");
  });

  it("returns 502 when AI estimate fails", async () => {
    await unlockSession();
    const spy = vi.spyOn(await import("../features/nutrition/nutrition-ai-provider.js"), "estimateMealNutrition");
    spy.mockRejectedValueOnce(new Error("Nutrition AI estimate failed"));

    const res = await request(app)
      .post("/api/nutrition/estimate")
      .set("authorization", authHeader)
      .send({ mealDescription: "burger" });

    expect(res.status).toBe(502);
    spy.mockRestore();
  });
});
