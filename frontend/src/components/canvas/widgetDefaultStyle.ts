import { normalizeWidgetDisplay } from "./widgetDisplayVariants";
import { normalizeWidgetSkin, type WidgetSkin } from "./widgetSkins";
import {
  getWidgetTypeDef,
  normalizeWidgetVariant,
  type WidgetSizeVariant,
} from "./widgetVariants";

export interface WidgetStyleChoice {
  variant: WidgetSizeVariant;
  skin: WidgetSkin;
  display: string;
}

export function getDefaultWidgetStyle(widgetKey: string): WidgetStyleChoice {
  const def = getWidgetTypeDef(widgetKey);
  const variant = normalizeWidgetVariant(widgetKey, def?.defaultVariant);
  return {
    variant,
    skin: normalizeWidgetSkin(undefined),
    display: normalizeWidgetDisplay(widgetKey, undefined),
  };
}
