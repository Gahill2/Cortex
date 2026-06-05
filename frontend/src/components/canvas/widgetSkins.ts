/** Visual design family — separate from S/M/L size. */
export type WidgetSkin = "cortex" | "notion" | "canva" | "ios";

export interface WidgetSkinDef {
  id: WidgetSkin;
  label: string;
  shortLabel: string;
  /** One-line hint for the style picker */
  hint: string;
  /** Shown in the style panel — what changes visually */
  description: string;
  /** Typography stack applied via CSS on the widget shell */
  fontFamily: string;
}

export const WIDGET_SKINS: WidgetSkinDef[] = [
  {
    id: "cortex",
    label: "Apple",
    shortLabel: "Ap",
    hint: "Frosted glass, SF-style type",
    description: "Vibrancy blur, soft borders, large rounded corners.",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  },
  {
    id: "notion",
    label: "Notion",
    shortLabel: "N",
    hint: "Flat, quiet, text-first blocks",
    description: "Small caps labels, tight spacing, neutral grays.",
    fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "canva",
    label: "Canva",
    shortLabel: "Cv",
    hint: "Bold color cards and gradients",
    description: "Heavy display type, gradient fills, poster-like cards.",
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
  },
  {
    id: "ios",
    label: "iOS",
    shortLabel: "iOS",
    hint: "Glass, large type, centered hero",
    description: "SF-style thin numbers, frosted glass, centered heroes.",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  },
];

export function normalizeWidgetSkin(raw: string | undefined): WidgetSkin {
  if (raw === "notion" || raw === "canva" || raw === "ios" || raw === "cortex") return raw;
  return "cortex";
}

export function getWidgetSkinDef(skin: WidgetSkin): WidgetSkinDef {
  return WIDGET_SKINS.find((s) => s.id === skin) ?? WIDGET_SKINS[0];
}
