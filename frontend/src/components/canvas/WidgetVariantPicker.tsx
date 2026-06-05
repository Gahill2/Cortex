import type { WidgetSizeVariant } from "./widgetVariants";
import { getWidgetTypeDef } from "./widgetVariants";

interface Props {
  widgetKey: string;
  selected: WidgetSizeVariant;
  onSelect: (variant: WidgetSizeVariant) => void;
  compact?: boolean;
}

/** S / M / L size chooser (iOS widget style). */
export function WidgetVariantPicker({ widgetKey, selected, onSelect, compact }: Props) {
  const def = getWidgetTypeDef(widgetKey);
  if (!def) return null;

  return (
    <div
      className={`widget-variant-picker${compact ? " widget-variant-picker--compact" : ""}`}
      role="radiogroup"
      aria-label={`${def.label} size`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {def.variants.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={selected === preset.id}
          className={`widget-variant-picker__btn${selected === preset.id ? " widget-variant-picker__btn--active" : ""}`}
          title={preset.label}
          onClick={() => onSelect(preset.id)}
        >
          <span
            className={`widget-variant-picker__preview widget-variant-picker__preview--${preset.id}`}
            aria-hidden
          />
          <span className="widget-variant-picker__label">{compact ? preset.shortLabel : preset.label}</span>
        </button>
      ))}
    </div>
  );
}
