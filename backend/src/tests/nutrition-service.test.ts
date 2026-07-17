import { describe, expect, it } from "vitest";
import { dayBoundsUtc, localDateKeyFromUtc, subtractDays, weekDateKeys } from "../features/nutrition/nutrition-date.js";
import { buildWeeklyFromEntries, sumEntries, EMPTY_TOTALS } from "../features/nutrition/nutrition-service.js";
import type { NutritionEntry } from "@prisma/client";

function mockEntry(partial: Partial<NutritionEntry> & { consumedAt: Date }): NutritionEntry {
  return {
    id: partial.id ?? "e1",
    userId: partial.userId ?? "u1",
    consumedAt: partial.consumedAt,
    originalDescription: partial.originalDescription ?? "meal",
    normalizedDescription: partial.normalizedDescription ?? "meal",
    mealType: partial.mealType ?? "lunch",
    calories: partial.calories ?? 500,
    proteinG: partial.proteinG ?? 30,
    carbsG: partial.carbsG ?? 40,
    fatG: partial.fatG ?? 20,
    fiberG: partial.fiberG ?? null,
    sugarG: partial.sugarG ?? null,
    sodiumMg: partial.sodiumMg ?? null,
    confidence: partial.confidence ?? "medium",
    assumptions: partial.assumptions ?? '["test"]',
    sourceType: partial.sourceType ?? "estimate",
    aiProvider: partial.aiProvider ?? "mock",
    aiModel: partial.aiModel ?? "mock-v1",
    userEdited: partial.userEdited ?? false,
    createdAt: partial.createdAt ?? partial.consumedAt,
    updatedAt: partial.updatedAt ?? partial.consumedAt,
  };
}

describe("nutrition date helpers", () => {
  it("computes local day bounds from tz offset", () => {
    const { start, end } = dayBoundsUtc("2026-07-17", 300);
    expect(start.toISOString()).toBe("2026-07-17T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-18T04:59:59.999Z");
  });

  it("maps UTC timestamps to local date keys", () => {
    const key = localDateKeyFromUtc(Date.parse("2026-07-17T06:00:00.000Z"), 300);
    expect(key).toBe("2026-07-17");
  });

  it("builds a 7-day key range ending on a date", () => {
    expect(weekDateKeys("2026-07-17")).toHaveLength(7);
    expect(weekDateKeys("2026-07-17")[0]).toBe(subtractDays("2026-07-17", 6));
  });
});

describe("nutrition aggregation", () => {
  it("sums macro totals", () => {
    const totals = sumEntries([
      mockEntry({ consumedAt: new Date("2026-07-17T12:00:00.000Z"), calories: 200, proteinG: 10 }),
      mockEntry({ consumedAt: new Date("2026-07-17T18:00:00.000Z"), calories: 300, proteinG: 20 }),
    ]);
    expect(totals.calories).toBe(500);
    expect(totals.proteinG).toBe(30);
    expect(totals.entryCount).toBe(2);
  });

  it("returns empty totals for no entries", () => {
    expect(sumEntries([])).toEqual(EMPTY_TOTALS);
  });

  it("groups weekly averages from a single entry batch", () => {
    const entries = [
      mockEntry({ consumedAt: new Date("2026-07-17T15:00:00.000Z"), calories: 700 }),
      mockEntry({ consumedAt: new Date("2026-07-16T15:00:00.000Z"), calories: 500 }),
    ];
    const weekly = buildWeeklyFromEntries(entries, "2026-07-17", 0);
    expect(weekly.days).toHaveLength(7);
    expect(weekly.averages.calories).toBe(600);
    expect(weekly.averages.daysWithEntries).toBe(2);
  });
});
