import type { NutritionEntry } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { settingsRepo } from "../../repositories/index.js";
import {
  DEFAULT_NUTRITION_TARGETS,
  type NutritionTargets,
} from "./nutrition-schemas.js";

export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  entryCount: number;
};

function toNumber(value: { toNumber?: () => number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

export function serializeEntry(row: NutritionEntry) {
  return {
    id: row.id,
    userId: row.userId,
    consumedAt: row.consumedAt.toISOString(),
    originalDescription: row.originalDescription,
    normalizedDescription: row.normalizedDescription,
    mealType: row.mealType,
    calories: row.calories,
    proteinG: toNumber(row.proteinG),
    carbsG: toNumber(row.carbsG),
    fatG: toNumber(row.fatG),
    fiberG: row.fiberG != null ? toNumber(row.fiberG) : null,
    sugarG: row.sugarG != null ? toNumber(row.sugarG) : null,
    sodiumMg: row.sodiumMg,
    confidence: row.confidence,
    assumptions: JSON.parse(row.assumptions) as string[],
    sourceType: row.sourceType,
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    userEdited: row.userEdited,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function sumEntries(entries: NutritionEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + toNumber(e.proteinG),
      carbsG: acc.carbsG + toNumber(e.carbsG),
      fatG: acc.fatG + toNumber(e.fatG),
      fiberG: acc.fiberG + toNumber(e.fiberG),
      sugarG: acc.sugarG + toNumber(e.sugarG),
      sodiumMg: acc.sodiumMg + (e.sodiumMg ?? 0),
      entryCount: acc.entryCount + 1,
    }),
    {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
      entryCount: 0,
    }
  );
}

export async function listEntries(userId: string, from: string, to: string) {
  return prisma.nutritionEntry.findMany({
    where: {
      userId,
      consumedAt: {
        gte: startOfDayUtc(from),
        lte: endOfDayUtc(to),
      },
    },
    orderBy: [{ consumedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getEntry(userId: string, id: string) {
  return prisma.nutritionEntry.findFirst({ where: { id, userId } });
}

export async function getTotalsForDate(userId: string, dateStr: string): Promise<MacroTotals> {
  const entries = await listEntries(userId, dateStr, dateStr);
  return sumEntries(entries);
}

export async function getWeeklyAverages(userId: string, endDateStr: string) {
  const end = new Date(`${endDateStr}T12:00:00.000Z`);
  const days: Array<{ date: string; totals: MacroTotals }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const totals = await getTotalsForDate(userId, date);
    days.push({ date, totals });
  }

  const withData = days.filter((d) => d.totals.entryCount > 0);
  const divisor = withData.length || 1;
  const sum = withData.reduce(
    (acc, d) => ({
      calories: acc.calories + d.totals.calories,
      proteinG: acc.proteinG + d.totals.proteinG,
      carbsG: acc.carbsG + d.totals.carbsG,
      fatG: acc.fatG + d.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return {
    days,
    averages: {
      calories: Math.round(sum.calories / divisor),
      proteinG: Math.round(sum.proteinG / divisor),
      carbsG: Math.round(sum.carbsG / divisor),
      fatG: Math.round(sum.fatG / divisor),
      daysWithEntries: withData.length,
    },
  };
}

export async function getNutritionTargets(userId: string): Promise<NutritionTargets> {
  const settings = await settingsRepo.get(userId);
  const extra = settings?.extraJson ?? {};
  const stored = (extra.nutritionTargets ?? {}) as Partial<NutritionTargets>;
  return {
    calorieTarget: stored.calorieTarget ?? DEFAULT_NUTRITION_TARGETS.calorieTarget,
    proteinTargetG: stored.proteinTargetG ?? DEFAULT_NUTRITION_TARGETS.proteinTargetG,
    carbsTargetG: stored.carbsTargetG ?? DEFAULT_NUTRITION_TARGETS.carbsTargetG,
    fatTargetG: stored.fatTargetG ?? DEFAULT_NUTRITION_TARGETS.fatTargetG,
    fiberTargetG: stored.fiberTargetG ?? DEFAULT_NUTRITION_TARGETS.fiberTargetG,
  };
}

export async function updateNutritionTargets(
  userId: string,
  patch: Partial<NutritionTargets>
): Promise<NutritionTargets> {
  const current = await getNutritionTargets(userId);
  const next = { ...current, ...patch };
  const settings = await settingsRepo.get(userId);
  await settingsRepo.upsert(userId, {
    extraJson: {
      ...(settings?.extraJson ?? {}),
      nutritionTargets: next,
    },
  });
  return next;
}

export function entriesToCsv(entries: NutritionEntry[]): string {
  const header = [
    "Date",
    "Time",
    "Original meal description",
    "Normalized meal description",
    "Meal type",
    "Calories",
    "Protein grams",
    "Carbohydrate grams",
    "Fat grams",
    "Fiber grams",
    "Sugar grams",
    "Sodium milligrams",
    "Confidence",
    "Assumptions",
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = entries.map((e) => {
    const consumed = e.consumedAt;
    const date = consumed.toISOString().slice(0, 10);
    const time = consumed.toISOString().slice(11, 19);
    const assumptions = (JSON.parse(e.assumptions) as string[]).join("; ");
    return [
      date,
      time,
      escape(e.originalDescription),
      escape(e.normalizedDescription),
      e.mealType,
      String(e.calories),
      toNumber(e.proteinG).toFixed(1),
      toNumber(e.carbsG).toFixed(1),
      toNumber(e.fatG).toFixed(1),
      e.fiberG != null ? toNumber(e.fiberG).toFixed(1) : "",
      e.sugarG != null ? toNumber(e.sugarG).toFixed(1) : "",
      e.sodiumMg != null ? String(e.sodiumMg) : "",
      e.confidence,
      escape(assumptions),
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
