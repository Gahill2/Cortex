import type { AppearanceMode } from "../AppearanceProvider";
import type { WallpaperState } from "../hooks/useWallpaper";
import type { AppTheme } from "../hooks/useTheme";
import type { CanvasBackground } from "../components/canvas/canvasBackground";
import { DEFAULT_CANVAS_BACKGROUND } from "../components/canvas/canvasBackground";
import type { CanvasLayoutPref, HabitPref, ServerSettings, WeatherLocationPref } from "./preferencesTypes";
import { EMPTY_SETTINGS } from "./preferencesTypes";
import { CORTEX_UI_PREFERENCE_KEYS } from "./cortexUiStorageKeys";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readAppearance(): AppearanceMode {
  const raw = localStorage.getItem("cortex_appearance");
  if (!raw) return "system";
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  }
  return "system";
}

function readWeatherUnits(): "metric" | "imperial" {
  const raw = localStorage.getItem("cortex_weather_units");
  if (raw === "fahrenheit") return "imperial";
  if (raw === "celsius") return "metric";
  if (raw === "imperial" || raw === "metric") return raw;
  return "metric";
}

function hasCanvasOnServer(layout: ServerSettings["canvasLayout"]): boolean {
  if (!layout || typeof layout !== "object") return false;
  const nodes = (layout as CanvasLayoutPref).nodes;
  return Array.isArray(nodes) && nodes.length > 0;
}

/** True when the server row has no meaningful UI prefs yet (safe to import browser data). */
export function isServerSettingsEmpty(settings: ServerSettings): boolean {
  const hasGoals = Array.isArray(settings.homeGoals) && settings.homeGoals.length > 0;
  const hasWallpaper =
    settings.wallpaper &&
    typeof settings.wallpaper === "object" &&
    (settings.wallpaper as WallpaperState).presetId &&
    (settings.wallpaper as WallpaperState).presetId !== "none";
  const hasTheme = Boolean(settings.aiTheme);
  const hasWeather =
    Boolean(settings.weatherCity) ||
    Boolean(settings.extraJson?.weatherLocation);
  const hasHabits =
    Array.isArray(settings.extraJson?.habits) && settings.extraJson!.habits!.length > 0;

  return (
    settings.appearance === "system" &&
    !hasWallpaper &&
    !hasTheme &&
    !hasGoals &&
    !hasWeather &&
    !hasHabits &&
    !hasCanvasOnServer(settings.canvasLayout)
  );
}

/** Read legacy localStorage and build a server PATCH payload. */
export function collectLocalPreferences(): Partial<ServerSettings> {
  const patch: Partial<ServerSettings> = {};
  const extra: NonNullable<ServerSettings["extraJson"]> = {};

  const appearance = readAppearance();
  if (appearance !== "system") patch.appearance = appearance;

  const wallpaper = readJson<WallpaperState>("cortex_wallpaper");
  if (wallpaper?.presetId && wallpaper.presetId !== "none") patch.wallpaper = wallpaper;

  const aiTheme = readJson<AppTheme>("cortex_ai_theme");
  if (aiTheme?.name) patch.aiTheme = aiTheme;

  const homeGoals = readJson<unknown[]>("cortex_home_goals");
  if (homeGoals?.length) patch.homeGoals = homeGoals;

  const weatherLoc = readJson<WeatherLocationPref>("cortex_weather_location");
  if (weatherLoc?.lat != null && weatherLoc?.lon != null) {
    extra.weatherLocation = weatherLoc;
    patch.weatherCity = weatherLoc.name;
  }
  patch.weatherUnits = readWeatherUnits();

  const canvasRaw = readJson<{ nodes: CanvasLayoutPref["nodes"]; pan: CanvasLayoutPref["pan"]; zoom: number }>(
    "cortex-canvas-state",
  );
  const background =
    readJson<CanvasBackground>("cortex-canvas-background") ?? DEFAULT_CANVAS_BACKGROUND;
  if (canvasRaw?.nodes?.length) {
    patch.canvasLayout = {
      nodes: canvasRaw.nodes,
      pan: canvasRaw.pan ?? { x: 0, y: 0 },
      zoom: canvasRaw.zoom ?? 1,
      background: background.kind !== "default" ? background : undefined,
    };
  } else if (background.kind !== "default") {
    patch.canvasLayout = {
      nodes: [],
      pan: { x: 0, y: 0 },
      zoom: 1,
      background,
    };
  }

  const habits = readJson<HabitPref[]>("cortex-habits");
  if (habits?.length) extra.habits = habits;

  const homeHero = readJson<Record<string, unknown>>("cortex_home_hero_config");
  if (homeHero && Object.keys(homeHero).length > 0) extra.homeHero = homeHero;

  if (Object.keys(extra).length > 0) patch.extraJson = extra;

  return patch;
}

export function clearMigratedLocalPreferences(): void {
  const keys = [
    ...CORTEX_UI_PREFERENCE_KEYS,
    "cortex-canvas-state",
    "cortex-habits",
  ] as const;
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function mergeSettings(base: ServerSettings, partial: Partial<ServerSettings>): ServerSettings {
  const next: ServerSettings = { ...base, ...partial };
  if (partial.extraJson !== undefined) {
    next.extraJson = {
      ...(base.extraJson ?? {}),
      ...(partial.extraJson ?? {}),
    };
  }
  if (partial.canvasLayout !== undefined) {
    next.canvasLayout = partial.canvasLayout;
  }
  return next;
}

export function normalizeLoadedSettings(raw: Partial<ServerSettings> | null | undefined): ServerSettings {
  if (!raw) return { ...EMPTY_SETTINGS };
  return mergeSettings(EMPTY_SETTINGS, raw);
}
