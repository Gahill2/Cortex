/** iOS-style size presets for canvas widgets (S / M / L). */
export type { WidgetSizeVariant } from "../../dashboard/types";
export type { WidgetVariantPreset, WidgetConfigField } from "../../dashboard/types";

import type { WidgetSizeVariant } from "../../dashboard/types";
import {
  getRegistryEntry,
  getCanvasWidgetTypes,
  WIDGET_REGISTRY,
} from "../../dashboard/widgetRegistry";

export interface WidgetTypeDef {
  key: string;
  label: string;
  icon: string;
  variants: import("../../dashboard/types").WidgetVariantPreset[];
  defaultVariant: WidgetSizeVariant;
}

export const CANVAS_WIDGET_TYPES: WidgetTypeDef[] = getCanvasWidgetTypes();

const FALLBACK_VARIANTS = CANVAS_WIDGET_TYPES[0]?.variants ?? [];

export function getWidgetTypeDef(widgetKey: string): WidgetTypeDef | undefined {
  return CANVAS_WIDGET_TYPES.find((t) => t.key === widgetKey);
}

export function getVariantPreset(
  widgetKey: string,
  variantId: WidgetSizeVariant | undefined,
): import("../../dashboard/types").WidgetVariantPreset {
  const def = getRegistryEntry(widgetKey) ?? getWidgetTypeDef(widgetKey);
  const id = variantId ?? def?.defaultVariant ?? "medium";
  const preset = def?.variants.find((p) => p.id === id);
  if (preset) return preset;
  return FALLBACK_VARIANTS.find((p) => p.id === id) ?? FALLBACK_VARIANTS[1] ?? {
    id: "medium",
    label: "Medium",
    shortLabel: "M",
    w: 380,
    h: 260,
    layout: "default",
  };
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
  const def = getRegistryEntry(widgetKey) ?? getWidgetTypeDef(widgetKey);
  if (raw === "small" || raw === "medium" || raw === "large") {
    if (def?.variants.some((v) => v.id === raw)) return raw;
  }
  return def?.defaultVariant ?? "medium";
}

/** All registered widget keys (for validation). */
export const REGISTERED_WIDGET_KEYS = WIDGET_REGISTRY.map((w) => w.key);
