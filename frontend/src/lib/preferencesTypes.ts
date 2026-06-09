import type { AppearanceMode } from "../AppearanceProvider";
import type { WallpaperState } from "../hooks/useWallpaper";
import type { AppTheme } from "../hooks/useTheme";
import type { CanvasBackground } from "../components/canvas/canvasBackground";
import type { CanvasNode } from "../components/canvas/CanvasDashboard";

import type { CanvasViewPrefs } from "../components/canvas/canvasViewPrefsTypes";

export interface WeatherLocationPref {
  lat: number;
  lon: number;
  name: string;
}

export interface CanvasLayoutPref {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
  background?: CanvasBackground;
}

export interface HabitPref {
  id: string;
  name: string;
  color: string;
  history: Record<string, boolean>;
}

export interface ServerSettings {
  appearance: AppearanceMode;
  wallpaper: WallpaperState | Record<string, unknown> | null;
  aiTheme: AppTheme | Record<string, unknown> | null;
  weatherCity: string | null;
  weatherUnits: "metric" | "imperial";
  homeGoals: unknown[] | null;
  canvasLayout: CanvasLayoutPref | Record<string, unknown> | null;
  extraJson: {
    weatherLocation?: WeatherLocationPref | null;
    habits?: HabitPref[];
    homeHero?: Record<string, unknown>;
    canvasViewPrefs?: CanvasViewPrefs;
    quickNote?: string;
    [key: string]: unknown;
  } | null;
  hasPinSet?: boolean;
  updatedAt?: string | null;
}

export const EMPTY_SETTINGS: ServerSettings = {
  appearance: "system",
  wallpaper: null,
  aiTheme: null,
  weatherCity: null,
  weatherUnits: "metric",
  homeGoals: null,
  canvasLayout: null,
  extraJson: null,
};
