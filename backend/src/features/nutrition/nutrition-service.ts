import type { NutritionEntry } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { settingsRepo } from "../../repositories/index.js";
import {
  dayBoundsUtc,
  localDateKeyFromUtc,
  parseTzOffset,
  weekDateKeys,
} from "./nutrition-date.js";
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

export const EMPTY_TOTALS: MacroTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
  entryCount: 0,
};

function toNumber(value: { toNumber?: () => number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function parseAssumptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
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
    assumptions: parseAssumptions(row.assumptions),
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
    { ...EMPTY_TOTALS }
  );
}

export function buildWeeklyFromEntries(
  entries: NutritionEntry[],
  endDateStr: string,
  tzOffsetMinutes: number
) {
  const grouped = new Map<string, NutritionEntry[]>();
  for (const key of weekDateKeys(endDateStr)) {
    grouped.set(key, []);
  }
  for (const entry of entries) {
    const key = localDateKeyFromUtc(entry.consumedAt.getTime(), tzOffsetMinutes);
    if (grouped.has(key)) {
      grouped.get(key)!.push(entry);
    }
  }

  const days = weekDateKeys(endDateStr).map((date) => ({
    date,
    totals: sumEntries(grouped.get(date) ?? []),
  }));

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

async function queryEntriesInRange(
  userId: string,
  fromDate: string,
  toDate: string,
  tzOffsetMinutes: number
) {
  const { start } = dayBoundsUtc(fromDate, tzOffsetMinutes);
  const { end } = dayBoundsUtc(toDate, tzOffsetMinutes);
  return prisma.nutritionEntry.findMany({
    where: {
      userId,
      consumedAt: { gte: start, lte: end },
    },
    orderBy: [{ consumedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function listEntries(
  userId: string,
  from: string,
  to: string,
  tzOffsetMinutes = 0
) {
  return queryEntriesInRange(userId, from, to, tzOffsetMinutes);
}

export async function getEntry(userId: string, id: string) {
  return prisma.nutritionEntry.findFirst({ where: { id, userId } });
}

export async function getTotalsForDate(
  userId: string,
  dateStr: string,
  tzOffsetMinutes = 0
): Promise<MacroTotals> {
  const entries = await queryEntriesInRange(userId, dateStr, dateStr, tzOffsetMinutes);
  return sumEntries(entries);
}

export async function getWeeklyAverages(
  userId: string,
  endDateStr: string,
  tzOffsetMinutes = 0
) {
  const startDate = weekDateKeys(endDateStr)[0];
  const entries = await queryEntriesInRange(userId, startDate, endDateStr, tzOffsetMinutes);
  return buildWeeklyFromEntries(entries, endDateStr, tzOffsetMinutes);
}

export async function getNutritionDashboard(
  userId: string,
  dateStr: string,
  tzOffsetMinutes = 0
) {
  const weekStart = weekDateKeys(dateStr)[0];
  const [weekEntries, targets] = await Promise.all([
    queryEntriesInRange(userId, weekStart, dateStr, tzOffsetMinutes),
    getNutritionTargets(userId),
  ]);

  const todayEntries = weekEntries.filter(
    (e) => localDateKeyFromUtc(e.consumedAt.getTime(), tzOffsetMinutes) === dateStr
  );

  return {
    date: dateStr,
    tzOffsetMinutes,
    totals: sumEntries(todayEntries),
    entries: todayEntries.map(serializeEntry),
    weekly: buildWeeklyFromEntries(weekEntries, dateStr, tzOffsetMinutes),
    targets,
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

export function entriesToCsv(entries: NutritionEntry[], tzOffsetMinutes = 0): string {
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
    const localMs = e.consumedAt.getTime() - tzOffsetMinutes * 60_000;
    const local = new Date(localMs);
    const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
    const time = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}:${String(local.getUTCSeconds()).padStart(2, "0")}`;
    const assumptions = parseAssumptions(e.assumptions).join("; ");
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

export { parseTzOffset };
