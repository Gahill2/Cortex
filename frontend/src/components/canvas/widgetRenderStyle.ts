import { normalizeWidgetDisplay } from "./widgetDisplayVariants";
import { getWidgetSkinDef, normalizeWidgetSkin, type WidgetSkin } from "./widgetSkins";
import { getVariantPreset, normalizeWidgetVariant, type WidgetSizeVariant } from "./widgetVariants";

export interface WidgetRenderStyle {
  variant: WidgetSizeVariant;
  skin: WidgetSkin;
  display: string;
  layout: "compact" | "default" | "expanded";
  fontFamily: string;
  displayFontFamily: string;
}

export function buildWidgetRenderStyle(
  widgetKey: string,
  variantRaw?: WidgetSizeVariant,
  skinRaw?: string,
  displayRaw?: string,
): WidgetRenderStyle {
  const variant = normalizeWidgetVariant(widgetKey, variantRaw);
  const preset = getVariantPreset(widgetKey, variant);
  const skin = normalizeWidgetSkin(skinRaw);
  const skinDef = getWidgetSkinDef(skin);
  const displayFont =
    skin === "ios"
      ? '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
      : skinDef.fontFamily;
  return {
    variant,
    skin,
    display: normalizeWidgetDisplay(widgetKey, displayRaw),
    layout: preset.layout,
    fontFamily: skinDef.fontFamily,
    displayFontFamily: displayFont,
  };
}
