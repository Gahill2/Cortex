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

export interface BoardTypography {
  textSizePx: number;
  /** 1 = 100% — multiplies base text size */
  textScale: number;
}

export interface UiCustomization extends BoardTypography {
  homeFont: HomeFontPreset;
  density: UiDensity;
  surfaceTone: SurfaceTone;
  accent: AccentPreset;
}

/** Base body size (px) — Figma-style presets are multiples of this reference. */
export const HOME_TEXT_BASE_PX = 14;

export const TEXT_SIZE_PRESETS = [
  { px: 12, label: "Small" },
  { px: 14, label: "Compact" },
  { px: 16, label: "16" },
  { px: 18, label: "18" },
  { px: 20, label: "20" },
  { px: 24, label: "Comfortable" },
  { px: 28, label: "28" },
  { px: 32, label: "Large" },
  { px: 36, label: "36" },
  { px: 40, label: "40" },
  { px: 48, label: "48" },
  { px: 56, label: "56" },
  { px: 64, label: "XL" },
  { px: 72, label: "72" },
  { px: 80, label: "80" },
  { px: 96, label: "Display" },
  { px: 112, label: "112" },
  { px: 128, label: "Hero" },
] as const;

export const TEXT_SIZE_MIN_PX = TEXT_SIZE_PRESETS[0]!.px;
export const TEXT_SIZE_MAX_PX = TEXT_SIZE_PRESETS[TEXT_SIZE_PRESETS.length - 1]!.px;

/** Percentage scale presets (stored as decimal: 1 = 100%). */
export const TEXT_SCALE_PRESETS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 0.82, label: "82%" },
  { value: 0.85, label: "85%" },
  { value: 0.9, label: "90%" },
  { value: 1, label: "100%" },
  { value: 1.1, label: "110%" },
  { value: 1.18, label: "118%" },
  { value: 1.25, label: "125%" },
  { value: 1.28, label: "128%" },
  { value: 1.5, label: "150%" },
  { value: 1.75, label: "175%" },
  { value: 2, label: "200%" },
] as const;

export const TEXT_SCALE_MIN = TEXT_SCALE_PRESETS[0]!.value;
export const TEXT_SCALE_MAX = TEXT_SCALE_PRESETS[TEXT_SCALE_PRESETS.length - 1]!.value;

/** Legacy combined multiplier (px / 14) — values above this are old saved sizes. */
const LEGACY_COMBINED_SCALE_MAX = 2.5;

export function clampTextSizePx(px: number): number {
  return Math.min(TEXT_SIZE_MAX_PX, Math.max(TEXT_SIZE_MIN_PX, Math.round(px)));
}

export function clampTextScale(scale: number): number {
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, scale));
}

export function textScaleToPercent(scale: number): number {
  return Math.round(clampTextScale(scale) * 100);
}

export function percentToTextScale(percent: number): number {
  return clampTextScale(percent / 100);
}

export function effectiveTextPx(typography: BoardTypography): number {
  return Math.round(clampTextSizePx(typography.textSizePx) * clampTextScale(typography.textScale));
}

export function boardTypographyFromUi(ui: Pick<UiCustomization, "textSizePx" | "textScale">): BoardTypography {
  return { textSizePx: ui.textSizePx, textScale: ui.textScale };
}

function legacyCombinedToTypography(combined: number): BoardTypography {
  return {
    textSizePx: clampTextSizePx(Math.round(combined * HOME_TEXT_BASE_PX)),
    textScale: 1,
  };
}

/** Per-widget typography — only when user explicitly overrides (typographyCustom). */
export function resolveWidgetTypography(
  widgetConfig: Record<string, unknown> | undefined,
  board: BoardTypography,
): BoardTypography {
  if (widgetConfig?.typographyCustom !== true) {
    return { textSizePx: board.textSizePx, textScale: board.textScale };
  }

  const rawSize = widgetConfig.textSizePx;
  const rawScale = widgetConfig.textScale;

  if (typeof rawSize === "number" && Number.isFinite(rawSize)) {
    return {
      textSizePx: clampTextSizePx(rawSize),
      textScale:
        typeof rawScale === "number" && Number.isFinite(rawScale) && rawScale <= LEGACY_COMBINED_SCALE_MAX
          ? clampTextScale(rawScale)
          : board.textScale,
    };
  }

  if (typeof rawScale === "number" && Number.isFinite(rawScale)) {
    if (rawScale > LEGACY_COMBINED_SCALE_MAX) {
      return legacyCombinedToTypography(rawScale);
    }
    return { textSizePx: board.textSizePx, textScale: clampTextScale(rawScale) };
  }

  return { textSizePx: board.textSizePx, textScale: board.textScale };
}

export function widgetHasOwnTypography(widgetConfig: Record<string, unknown> | undefined): boolean {
  return widgetConfig?.typographyCustom === true;
}

/** Drop auto-baked typography keys from saved widget configs (inherit board). */
export function stripBakedWidgetTypography(
  config: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!config) return undefined;
  if (config.typographyCustom === true) return config;
  const next = { ...config };
  delete next.textSizePx;
  delete next.textScale;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** @deprecated Use effectiveTextPx(resolveWidgetTypography(...)) */
export function scaleToTextPx(scale: number): number {
  return effectiveTextPx(legacyCombinedToTypography(scale));
}

export function snapTextSizePx(px: number): number {
  return clampTextSizePx(nearestPresetPx(px));
}

export function snapTextScale(scale: number): number {
  let best: number = TEXT_SCALE_PRESETS[0]!.value;
  let dist = Math.abs(scale - best);
  for (const p of TEXT_SCALE_PRESETS) {
    const d = Math.abs(scale - p.value);
    if (d < dist) {
      dist = d;
      best = p.value;
    }
  }
  return best;
}

export function nearestPresetPx(px: number): number {
  let bestPx: number = TEXT_SIZE_PRESETS[0]!.px;
  let dist = Math.abs(px - bestPx);
  for (const p of TEXT_SIZE_PRESETS) {
    const d = Math.abs(px - p.px);
    if (d < dist) {
      dist = d;
      bestPx = p.px;
    }
  }
  return bestPx;
}

/** @deprecated Legacy combined scale */
export function snapScaleToTextPreset(scale: number): number {
  return snapTextSizePx(scale * HOME_TEXT_BASE_PX) / HOME_TEXT_BASE_PX;
}

export const DEFAULT_UI_CUSTOMIZATION: UiCustomization = {
  homeFont: "system",
  textSizePx: 16,
  textScale: 1,
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
  { id: "compact", label: "Compact", scale: 0.94 },
  { id: "comfortable", label: "Comfortable", scale: 1.08 },
  { id: "spacious", label: "Spacious", scale: 1.22 },
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
  let textSizePx =
    typeof o.textSizePx === "number" && Number.isFinite(o.textSizePx)
      ? clampTextSizePx(o.textSizePx)
      : DEFAULT_UI_CUSTOMIZATION.textSizePx;
  let textScale =
    typeof o.textScale === "number" && Number.isFinite(o.textScale)
      ? clampTextScale(o.textScale)
      : DEFAULT_UI_CUSTOMIZATION.textScale;

  if (typeof o.homeFontScale === "number" && Number.isFinite(o.homeFontScale) && o.textSizePx === undefined) {
    const migrated = legacyCombinedToTypography(o.homeFontScale);
    textSizePx = migrated.textSizePx;
    textScale = o.textScale === undefined ? migrated.textScale : textScale;
  }

  return { homeFont, textSizePx, textScale, density, surfaceTone, accent };
}

export function parseGoals(raw: unknown): CortexGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === "object"))
    .map((g) => ({
      id: typeof g.id === "string" ? g.id : `goal_${Date.now()}`,
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

  const effectivePx = effectiveTextPx(ui);

  root.style.setProperty("--home-font-body", font.stack);
  root.style.setProperty("--home-text-base-px", `${ui.textSizePx}px`);
  root.style.setProperty("--home-text-scale", String(ui.textScale));
  root.style.setProperty("--home-text-size-px", `${effectivePx}px`);
  root.style.setProperty("--home-font-scale", String(ui.textScale));
  root.style.setProperty("--app-font-scale", String(ui.textScale));
  root.style.setProperty("--widget-font-body", font.stack);
  root.style.setProperty("--widget-font-display", font.stack);
  root.style.setProperty("--ui-density-scale", String(density.scale));
  root.style.setProperty("--accent", accent.hex);
  root.style.setProperty("--accent-dim", ACCENT_DIM[ui.accent]);
  root.style.setProperty("--apple-blue", accent.hex);
  root.style.setProperty("--apple-blue-dim", ACCENT_DIM[ui.accent]);
  root.style.setProperty("--brand-blue", accent.hex);

  const spaceBase = 5;
  for (let i = 1; i <= 7; i++) {
    const px = Math.round(spaceBase * i * density.scale);
    root.style.setProperty(`--space-${i}`, `${px}px`);
  }
  root.style.setProperty("--widget-pad-scale", String(density.scale * ui.textScale));
}
