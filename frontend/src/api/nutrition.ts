import { api } from "./client";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "unknown";
export type ConfidenceLevel = "low" | "medium" | "high";

export type NutritionEstimate = {
  originalDescription: string;
  normalizedDescription: string;
  mealType: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  confidence: ConfidenceLevel;
  assumptions: string[];
  sourceType: string;
  aiProvider?: string;
  aiModel?: string;
};

export type NutritionEntry = NutritionEstimate & {
  id: string;
  userId: string;
  consumedAt: string;
  userEdited: boolean;
  createdAt: string;
  updatedAt: string;
};

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

export type NutritionTargets = {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
};

export type WeeklyNutrition = {
  days: Array<{ date: string; totals: MacroTotals }>;
  averages: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    daysWithEntries: number;
  };
};

export type NutritionDashboard = {
  date: string;
  tzOffsetMinutes: number;
  totals: MacroTotals;
  entries: NutritionEntry[];
  weekly: WeeklyNutrition;
  targets: NutritionTargets;
};

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export function timezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

export async function estimateNutrition(mealDescription: string, consumedAt?: string) {
  const res = await api.post<{ data: NutritionEstimate & { aiProvider?: string; aiModel?: string } }>(
    "/nutrition/estimate",
    { mealDescription, consumedAt }
  );
  return unwrap(res);
}

export async function saveNutritionEntry(payload: NutritionEstimate & {
  consumedAt: string;
  aiProvider?: string | null;
  aiModel?: string | null;
  userEdited?: boolean;
}) {
  const res = await api.post<{ data: NutritionEntry }>("/nutrition/entries", payload);
  return unwrap(res);
}

export async function listNutritionEntries(from: string, to: string) {
  const res = await api.get<{ data: NutritionEntry[] }>("/nutrition/entries", {
    params: { from, to, tzOffset: timezoneOffsetMinutes() },
  });
  return unwrap(res);
}

export async function getNutritionDashboard(date = localDateIso()) {
  const res = await api.get<{ data: NutritionDashboard }>("/nutrition/dashboard", {
    params: { date, tzOffset: timezoneOffsetMinutes() },
  });
  return unwrap(res);
}

export async function updateNutritionEntry(id: string, patch: Partial<NutritionEntry>) {
  const res = await api.patch<{ data: NutritionEntry }>(`/nutrition/entries/${id}`, patch);
  return unwrap(res);
}

export async function deleteNutritionEntry(id: string) {
  const res = await api.delete<{ data: { ok: boolean; id: string } }>(`/nutrition/entries/${id}`);
  return unwrap(res);
}

export async function getTodayTotals() {
  const res = await api.get<{ data: { date: string; totals: MacroTotals } }>("/nutrition/totals/today", {
    params: { tzOffset: timezoneOffsetMinutes() },
  });
  return unwrap(res);
}

export async function getWeeklyTotals(endDate?: string) {
  const res = await api.get<{ data: WeeklyNutrition }>("/nutrition/totals/weekly", {
    params: { endDate, tzOffset: timezoneOffsetMinutes() },
  });
  return unwrap(res);
}

export async function getNutritionTargets() {
  const res = await api.get<{ data: NutritionTargets }>("/nutrition/targets");
  return unwrap(res);
}

export async function updateNutritionTargets(patch: Partial<NutritionTargets>) {
  const res = await api.patch<{ data: NutritionTargets }>("/nutrition/targets", patch);
  return unwrap(res);
}

export async function exportNutritionLog(from: string, to: string): Promise<Blob> {
  const res = await api.get("/nutrition/export", {
    params: { from, to, tzOffset: timezoneOffsetMinutes() },
    responseType: "blob",
  });
  return res.data as Blob;
}

export function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localDateTimeIso(d = new Date()): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${d.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}
