import { CORTEX_HOME_HERO_STORAGE_KEY } from "../components/home/homeHeroConfig";

/**
 * localStorage keys cleared by “Reset Cortex UI preferences”.
 * Intentionally excludes auth (`cortex_token`, `cortex_user`), MCP link fields, and integration tokens.
 */
export const CORTEX_UI_PREFERENCE_KEYS = [
  "cortex_appearance",
  "cortex_wallpaper",
  "cortex_ai_theme",
  "cortex_widget_grid",
  "cortex_weather_location",
  "cortex_weather_units",
  "cortex_home_goals",
  "cortex_briefing_at",
  "cortex_photo_widget",
  "cortex-canvas-background",
  "cortex-canvas-state",
  "cortex-habits",
  CORTEX_HOME_HERO_STORAGE_KEY,
] as const;

export function clearCortexUiPreferences(): void {
  for (const key of CORTEX_UI_PREFERENCE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore quota / private mode */
    }
  }
}
