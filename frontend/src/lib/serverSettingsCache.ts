import type { ServerSettings } from "./serverSettingsTypes";

export const EMPTY_SERVER_SETTINGS: ServerSettings = {
  appearance: "system",
  wallpaper: null,
  aiTheme: null,
  weatherCity: null,
  weatherUnits: "metric",
  homeGoals: null,
  canvasLayout: null,
  extraJson: null,
};

let cachedSettings: ServerSettings | null = null;
let cachedForToken: string | null = null;

export function getCachedServerSettings(token: string | null): ServerSettings | null {
  if (!token || !cachedSettings || cachedForToken !== token) return null;
  return cachedSettings;
}

export function setCachedServerSettings(token: string, settings: ServerSettings): void {
  cachedSettings = settings;
  cachedForToken = token;
}

export function invalidateServerSettingsCache(): void {
  cachedSettings = null;
  cachedForToken = null;
}
