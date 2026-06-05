import type { WidgetSkin } from "../components/canvas/widgetSkins";

export type WidgetSizeVariant = "small" | "medium" | "large";

export type WidgetCategory =
  | "productivity"
  | "calendar"
  | "email"
  | "music"
  | "system"
  | "automations"
  | "analytics";

export type WidgetConfigFieldType = "text" | "toggle" | "boolean" | "color" | "select" | "number";

export interface WidgetConfigField {
  key: string;
  label: string;
  type: WidgetConfigFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

/** Per-instance settings stored on CanvasNode.widgetConfig */
export interface WidgetInstanceConfig {
  title?: string;
  accentColor?: string;
  compact?: boolean;
  [key: string]: unknown;
}

export interface WidgetVariantPreset {
  id: WidgetSizeVariant;
  label: string;
  shortLabel: string;
  w: number;
  h: number;
  layout: "compact" | "default" | "expanded";
}

export interface WidgetRegistryEntry {
  key: string;
  label: string;
  icon: string;
  category: WidgetCategory;
  description: string;
  variants: WidgetVariantPreset[];
  defaultVariant: WidgetSizeVariant;
  defaultSkin?: WidgetSkin;
  defaultDisplay?: string;
  configFields?: WidgetConfigField[];
  previewGradient?: string;
}

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  productivity: "Productivity",
  calendar: "Calendar",
  email: "Email",
  music: "Music",
  system: "System",
  automations: "Automations",
  analytics: "Analytics",
};
