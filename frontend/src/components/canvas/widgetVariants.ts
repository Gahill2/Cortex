/** iOS-style size presets for canvas widgets (S / M / L). */
export type WidgetSizeVariant = "small" | "medium" | "large";

export interface WidgetVariantPreset {
  id: WidgetSizeVariant;
  label: string;
  shortLabel: string;
  w: number;
  h: number;
  /** Layout density passed to widget components */
  layout: "compact" | "default" | "expanded";
}

export interface WidgetTypeDef {
  key: string;
  label: string;
  icon: string;
  variants: WidgetVariantPreset[];
  defaultVariant: WidgetSizeVariant;
}

const v = (
  id: WidgetSizeVariant,
  label: string,
  w: number,
  h: number,
  layout: WidgetVariantPreset["layout"],
): WidgetVariantPreset => ({
  id,
  label,
  shortLabel: id === "small" ? "S" : id === "medium" ? "M" : "L",
  w,
  h,
  layout,
});

const STANDARD_VARIANTS: WidgetVariantPreset[] = [
  v("small", "Small", 260, 180, "compact"),
  v("medium", "Medium", 380, 260, "default"),
  v("large", "Large", 480, 340, "expanded"),
];

const TALL_VARIANTS: WidgetVariantPreset[] = [
  v("small", "Small", 260, 200, "compact"),
  v("medium", "Medium", 380, 300, "default"),
  v("large", "Large", 520, 400, "expanded"),
];

const WIDE_VARIANTS: WidgetVariantPreset[] = [
  v("small", "Small", 300, 180, "compact"),
  v("medium", "Medium", 420, 280, "default"),
  v("large", "Large", 560, 360, "expanded"),
];

export const CANVAS_WIDGET_TYPES: WidgetTypeDef[] = [
  { key: "weather", label: "Weather", icon: "☀️", variants: STANDARD_VARIANTS, defaultVariant: "medium" },
  { key: "tasks", label: "Tasks", icon: "✓", variants: TALL_VARIANTS, defaultVariant: "medium" },
  { key: "mail", label: "Mail", icon: "✉", variants: TALL_VARIANTS, defaultVariant: "medium" },
  { key: "spotify", label: "Music", icon: "♫", variants: STANDARD_VARIANTS, defaultVariant: "medium" },
  { key: "ai", label: "AI Chat", icon: "🤖", variants: WIDE_VARIANTS, defaultVariant: "medium" },
  { key: "pomodoro", label: "Focus Timer", icon: "⏱️", variants: STANDARD_VARIANTS, defaultVariant: "medium" },
  { key: "clock", label: "World Clock", icon: "🕐", variants: STANDARD_VARIANTS, defaultVariant: "medium" },
  { key: "habits", label: "Habit Tracker", icon: "📊", variants: TALL_VARIANTS, defaultVariant: "medium" },
  { key: "quote", label: "Daily Quote", icon: "💬", variants: STANDARD_VARIANTS, defaultVariant: "small" },
];

export function getWidgetTypeDef(widgetKey: string): WidgetTypeDef | undefined {
  return CANVAS_WIDGET_TYPES.find((t) => t.key === widgetKey);
}

export function getVariantPreset(
  widgetKey: string,
  variantId: WidgetSizeVariant | undefined,
): WidgetVariantPreset {
  const def = getWidgetTypeDef(widgetKey);
  const id = variantId ?? def?.defaultVariant ?? "medium";
  const preset = def?.variants.find((p) => p.id === id);
  if (preset) return preset;
  return STANDARD_VARIANTS.find((p) => p.id === id) ?? STANDARD_VARIANTS[1];
}

export function widgetBaseSize(
  widgetKey: string,
  variantId?: WidgetSizeVariant,
): { w: number; h: number } {
  const preset = getVariantPreset(widgetKey, variantId);
  return { w: preset.w, h: preset.h };
}

export function normalizeWidgetVariant(
  widgetKey: string,
  raw: string | undefined,
): WidgetSizeVariant {
  const def = getWidgetTypeDef(widgetKey);
  if (raw === "small" || raw === "medium" || raw === "large") {
    if (def?.variants.some((v) => v.id === raw)) return raw;
  }
  return def?.defaultVariant ?? "medium";
}
