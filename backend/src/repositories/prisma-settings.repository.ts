import { prisma } from "../db/prisma.js";
import type { SettingsRepository, UserSettingsData } from "./interfaces.js";

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseJsonArray(raw: string | null): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function toData(row: {
  userId: string;
  appearance: string;
  wallpaper: string | null;
  aiTheme: string | null;
  weatherCity: string | null;
  weatherUnits: string;
  homeGoals: string | null;
  pinHash: string | null;
  canvasLayout: string | null;
  extraJson: string | null;
}): UserSettingsData {
  return {
    userId: row.userId,
    appearance: row.appearance,
    wallpaper: parseJson(row.wallpaper),
    aiTheme: parseJson(row.aiTheme),
    weatherCity: row.weatherCity,
    weatherUnits: row.weatherUnits,
    homeGoals: parseJsonArray(row.homeGoals),
    pinHash: row.pinHash,
    canvasLayout: parseJson(row.canvasLayout),
    extraJson: parseJson(row.extraJson),
  };
}

export class PrismaSettingsRepository implements SettingsRepository {
  async get(userId: string): Promise<UserSettingsData | null> {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    return row ? toData(row) : null;
  }

  async upsert(userId: string, data: Partial<Omit<UserSettingsData, "userId">>): Promise<UserSettingsData> {
    const serialized: Record<string, unknown> = {};

    if (data.appearance !== undefined) serialized.appearance = data.appearance;
    if (data.wallpaper !== undefined) serialized.wallpaper = data.wallpaper ? JSON.stringify(data.wallpaper) : null;
    if (data.aiTheme !== undefined) serialized.aiTheme = data.aiTheme ? JSON.stringify(data.aiTheme) : null;
    if (data.weatherCity !== undefined) serialized.weatherCity = data.weatherCity;
    if (data.weatherUnits !== undefined) serialized.weatherUnits = data.weatherUnits;
    if (data.homeGoals !== undefined) serialized.homeGoals = data.homeGoals ? JSON.stringify(data.homeGoals) : null;
    if (data.pinHash !== undefined) serialized.pinHash = data.pinHash;
    if (data.canvasLayout !== undefined) serialized.canvasLayout = data.canvasLayout ? JSON.stringify(data.canvasLayout) : null;
    if (data.extraJson !== undefined) serialized.extraJson = data.extraJson ? JSON.stringify(data.extraJson) : null;

    const row = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...serialized } as Parameters<typeof prisma.userSettings.create>[0]["data"],
      update: serialized,
    });

    return toData(row);
  }
}
