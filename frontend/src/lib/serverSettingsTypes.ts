export interface ServerSettings {
  appearance: string;
  wallpaper: Record<string, unknown> | null;
  aiTheme: Record<string, unknown> | null;
  weatherCity: string | null;
  weatherUnits: string;
  homeGoals: unknown[] | null;
  canvasLayout: Record<string, unknown> | null;
  extraJson: Record<string, unknown> | null;
  hasPinSet?: boolean;
}
