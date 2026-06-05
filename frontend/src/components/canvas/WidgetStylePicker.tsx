import type { WidgetSkin } from "./widgetSkins";
import { WIDGET_SKINS } from "./widgetSkins";
import type { WidgetSizeVariant } from "./widgetVariants";
import { getWidgetTypeDef } from "./widgetVariants";
import { getWidgetDisplayOptions } from "./widgetDisplayVariants";
import { WidgetVariantPicker } from "./WidgetVariantPicker";

interface Props {
  widgetKey: string;
  size: WidgetSizeVariant;
  skin: WidgetSkin;
  display: string;
  onSize: (variant: WidgetSizeVariant) => void;
  onSkin: (skin: WidgetSkin) => void;
  onDisplay: (display: string) => void;
  /** Wider layout for the Add-widget menu */
  variant?: "compact" | "panel";
}

function skinSummary(skin: WidgetSkin, display: string, displays: { id: string; label: string }[]): string {
  const skinDef = WIDGET_SKINS.find((s) => s.id === skin);
  const layout = displays.find((d) => d.id === display);
  return [skinDef?.label, layout?.label].filter(Boolean).join(" · ");
}

/** Size, design family, and per-widget layout — used when adding and editing widgets. */
export function WidgetStylePicker({
  widgetKey,
  size,
  skin,
  display,
  onSize,
  onSkin,
  onDisplay,
  variant = "compact",
}: Props) {
  const def = getWidgetTypeDef(widgetKey);
  const displays = getWidgetDisplayOptions(widgetKey);
  const showDisplay = displays.length > 1;
  const isPanel = variant === "panel";

  return (
    <div
      className={`widget-style-picker${isPanel ? " widget-style-picker--panel" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isPanel && def ? (
        <p className="widget-style-picker__summary">
          <span className="widget-style-picker__summary-label">{def.label}</span>
          <span className="widget-style-picker__summary-meta">{skinSummary(skin, display, displays)}</span>
        </p>
      ) : null}

      {def ? (
        <div className="widget-style-picker__section">
          <span className="widget-style-picker__heading">Size</span>
          <p className="widget-style-picker__hint">Tile footprint on the canvas</p>
          <WidgetVariantPicker widgetKey={widgetKey} selected={size} onSelect={onSize} />
        </div>
      ) : null}

      <div className="widget-style-picker__section">
        <span className="widget-style-picker__heading">Design</span>
        <p className="widget-style-picker__hint">Fonts, chrome, and overall feel</p>
        <div className="widget-style-picker__skin-grid" role="radiogroup" aria-label="Widget design">
          {WIDGET_SKINS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={skin === s.id}
              title={s.hint}
              className={`widget-style-picker__skin-card${skin === s.id ? " widget-style-picker__skin-card--active" : ""}`}
              onClick={() => onSkin(s.id)}
            >
              <span
                className={`widget-style-picker__skin-swatch widget-style-picker__skin-swatch--${s.id}`}
                aria-hidden
              />
              <span className="widget-style-picker__skin-card-text">
                <span className="widget-style-picker__skin-label">{s.label}</span>
                <span className="widget-style-picker__skin-desc">{s.description}</span>
                <span className="widget-style-picker__skin-font">
                  {s.fontFamily.split(",")[0]?.replace(/['"]/g, "")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {showDisplay ? (
        <div className="widget-style-picker__section">
          <span className="widget-style-picker__heading">Layout</span>
          <p className="widget-style-picker__hint">How this widget arranges its content</p>
          <div className="widget-style-picker__display-grid" role="radiogroup" aria-label="Widget layout">
            {displays.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={display === d.id}
                title={d.description ?? d.label}
                className={`widget-style-picker__layout-card${display === d.id ? " widget-style-picker__layout-card--active" : ""}`}
                onClick={() => onDisplay(d.id)}
              >
                <span className="widget-style-picker__layout-title">{d.label}</span>
                {d.description ? (
                  <span className="widget-style-picker__layout-desc">{d.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
