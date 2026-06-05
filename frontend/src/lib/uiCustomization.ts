/** User-facing UI tuning stored in settings.extraJson.ui */

export type HomeFontPreset = "system" | "rounded" | "serif" | "mono";
export type UiDensity = "compact" | "comfortable" | "spacious";
export type SurfaceTone = "neutral" | "warm" | "cool";
export type AccentPreset = "blue" | "teal" | "violet" | "amber" | "rose";

export interface CortexGoal {
  id: string;
  text: string;
  done: boolean;
  /** ISO date — target completion */
  targetDate?: string | null;
  /** Total estimated hours for the goal */
  estimateHours?: number;
  /** 0–100 manual progress */
  progressPercent?: number;
  category?: string;
}

export interface UiCustomization {
  homeFont: HomeFontPreset;
  homeFontScale: number;
  density: UiDensity;
  surfaceTone: SurfaceTone;
  accent: AccentPreset;
}

export const DEFAULT_UI_CUSTOMIZATION: UiCustomization = {
  homeFont: "system",
  homeFontScale: 1,
  density: "comfortable",
  surfaceTone: "warm",
  accent: "blue",
};

export const HOME_FONT_OPTIONS: { id: HomeFontPreset; label: string; stack: string }[] = [
  {
    id: "system",
    label: "System",
    stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
  },
  {
    id: "rounded",
    label: "Rounded",
    stack: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "serif",
    label: "Editorial",
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  },
  {
    id: "mono",
    label: "Technical",
    stack: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
  },
];

export const DENSITY_OPTIONS: { id: UiDensity; label: string; scale: number }[] = [
  { id: "compact", label: "Compact", scale: 0.88 },
  { id: "comfortable", label: "Comfortable", scale: 1 },
  { id: "spacious", label: "Spacious", scale: 1.14 },
];

export const SURFACE_OPTIONS: { id: SurfaceTone; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
];

export const ACCENT_OPTIONS: { id: AccentPreset; label: string; hex: string }[] = [
  { id: "blue", label: "Blue", hex: "#0a84ff" },
  { id: "teal", label: "Teal", hex: "#3be8ad" },
  { id: "violet", label: "Violet", hex: "#bf5af2" },
  { id: "amber", label: "Amber", hex: "#ff9f0a" },
  { id: "rose", label: "Rose", hex: "#ff375f" },
];

const ACCENT_DIM: Record<AccentPreset, string> = {
  blue: "rgba(10, 132, 255, 0.18)",
  teal: "rgba(59, 232, 173, 0.18)",
  violet: "rgba(191, 90, 242, 0.18)",
  amber: "rgba(255, 159, 10, 0.18)",
  rose: "rgba(255, 55, 95, 0.18)",
};

export function parseUiCustomization(raw: unknown): UiCustomization {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_UI_CUSTOMIZATION };
  const o = raw as Record<string, unknown>;
  const homeFont = HOME_FONT_OPTIONS.some((f) => f.id === o.homeFont)
    ? (o.homeFont as HomeFontPreset)
    : DEFAULT_UI_CUSTOMIZATION.homeFont;
  const density = DENSITY_OPTIONS.some((d) => d.id === o.density)
    ? (o.density as UiDensity)
    : DEFAULT_UI_CUSTOMIZATION.density;
  const surfaceTone = SURFACE_OPTIONS.some((s) => s.id === o.surfaceTone)
    ? (o.surfaceTone as SurfaceTone)
    : DEFAULT_UI_CUSTOMIZATION.surfaceTone;
  const accent = ACCENT_OPTIONS.some((a) => a.id === o.accent)
    ? (o.accent as AccentPreset)
    : DEFAULT_UI_CUSTOMIZATION.accent;
  let homeFontScale =
    typeof o.homeFontScale === "number" && Number.isFinite(o.homeFontScale)
      ? o.homeFontScale
      : DEFAULT_UI_CUSTOMIZATION.homeFontScale;
  homeFontScale = Math.min(1.28, Math.max(0.82, homeFontScale));
  return { homeFont, homeFontScale, density, surfaceTone, accent };
}

export function parseGoals(raw: unknown): CortexGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === "object"))
    .map((g) => ({
      id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
      text: typeof g.text === "string" ? g.text : "Goal",
      done: Boolean(g.done),
      targetDate: typeof g.targetDate === "string" ? g.targetDate : null,
      estimateHours:
        typeof g.estimateHours === "number" && g.estimateHours > 0 ? g.estimateHours : undefined,
      progressPercent:
        typeof g.progressPercent === "number"
          ? Math.min(100, Math.max(0, g.progressPercent))
          : undefined,
      category: typeof g.category === "string" ? g.category : undefined,
    }));
}

export function goalProgress(goal: CortexGoal): number {
  if (goal.done) return 100;
  if (typeof goal.progressPercent === "number") return goal.progressPercent;
  return 0;
}

/** Estimated completion from remaining hours at ~2h productive per calendar day. */
export function goalEstimatedCompletion(goal: CortexGoal): Date | null {
  if (goal.done) return null;
  const pct = goalProgress(goal) / 100;
  const hours = goal.estimateHours ?? 4;
  const remainingHours = hours * (1 - pct);
  if (remainingHours <= 0.05) return new Date();
  const days = Math.max(0.25, remainingHours / 6);
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  if (goal.targetDate) {
    const target = new Date(goal.targetDate);
    if (!Number.isNaN(target.getTime()) && target.getTime() < d.getTime()) return target;
  }
  return d;
}

export function formatEtc(iso: Date | null): string {
  if (!iso) return "Done";
  const now = new Date();
  const diffMs = iso.getTime() - now.getTime();
  if (diffMs < 0) return "Past due";
  const days = Math.ceil(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `~${days}d`;
  return iso.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function applyUiCustomizationToDocument(ui: UiCustomization): void {
  const root = document.documentElement;
  const font = HOME_FONT_OPTIONS.find((f) => f.id === ui.homeFont) ?? HOME_FONT_OPTIONS[0]!;
  const density = DENSITY_OPTIONS.find((d) => d.id === ui.density) ?? DENSITY_OPTIONS[1]!;
  const accent = ACCENT_OPTIONS.find((a) => a.id === ui.accent) ?? ACCENT_OPTIONS[0]!;

  root.dataset.uiDensity = ui.density;
  root.dataset.surfaceTone = ui.surfaceTone;

  root.style.setProperty("--home-font-body", font.stack);
  root.style.setProperty("--home-font-scale", String(ui.homeFontScale));
  root.style.setProperty("--widget-font-body", font.stack);
  root.style.setProperty("--widget-font-display", font.stack);
  root.style.setProperty("--ui-density-scale", String(density.scale));
  root.style.setProperty("--accent", accent.hex);
  root.style.setProperty("--accent-dim", ACCENT_DIM[ui.accent]);
  root.style.setProperty("--apple-blue", accent.hex);
  root.style.setProperty("--apple-blue-dim", ACCENT_DIM[ui.accent]);
  root.style.setProperty("--brand-blue", accent.hex);

  const spaceBase = 4;
  for (let i = 1; i <= 7; i++) {
    const px = Math.round(spaceBase * i * density.scale);
    root.style.setProperty(`--space-${i}`, `${px}px`);
  }
}
