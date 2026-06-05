import type { CanvasNode } from "./CanvasDashboard";
import type { WidgetSkin } from "./widgetSkins";
import type { WidgetSizeVariant } from "./widgetVariants";
import { getRegistryEntry } from "../../dashboard/widgetRegistry";
import type { WidgetConfigField } from "../../dashboard/types";

interface Props {
  node: CanvasNode;
  onUpdate: (patch: Partial<CanvasNode>) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const SKINS: { value: WidgetSkin; label: string }[] = [
  { value: "ios", label: "iOS" },
  { value: "notion", label: "Notion" },
  { value: "cortex", label: "Cortex" },
  { value: "canva", label: "Canva" },
];

const SIZES: { value: WidgetSizeVariant; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: WidgetConfigField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <div className="wcp-field">
          <label className="wcp-field__label">{field.label}</label>
          <input
            className="wcp-field__input"
            type="text"
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "color":
      return (
        <div className="wcp-field">
          <label className="wcp-field__label">{field.label}</label>
          <div className="wcp-field__color-row">
            <input
              className="wcp-field__color-swatch"
              type="color"
              value={typeof value === "string" ? value : "#5b8dff"}
              onChange={(e) => onChange(e.target.value)}
            />
            <span className="wcp-field__color-hex">
              {typeof value === "string" ? value : "#5b8dff"}
            </span>
          </div>
        </div>
      );
    case "toggle": // boolean toggle switch
      return (
        <div className="wcp-field wcp-field--row">
          <label className="wcp-field__label">{field.label}</label>
          <button
            className={`wcp-toggle${value ? " wcp-toggle--on" : ""}`}
            role="switch"
            aria-checked={Boolean(value)}
            onClick={() => onChange(!value)}
            type="button"
          >
            <span className="wcp-toggle__thumb" />
          </button>
        </div>
      );
    case "select":
      return (
        <div className="wcp-field">
          <label className="wcp-field__label">{field.label}</label>
          <select
            className="wcp-field__select"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    default:
      return (
        <div className="wcp-field">
          <label className="wcp-field__label">{field.label}</label>
          <input
            className="wcp-field__input"
            type="number"
            value={typeof value === "number" ? value : ""}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );
  }
}

export function WidgetConfigPanel({ node, onUpdate, onClose, onDelete, onDuplicate }: Props) {
  const entry = node.widgetKey ? getRegistryEntry(node.widgetKey) : undefined;
  const widgetConfig = node.widgetConfig ?? {};
  const currentSkin = node.widgetSkin ?? "ios";
  const currentVariant = node.widgetVariant ?? "medium";
  const currentOpacity = node.opacity !== undefined ? Math.round(node.opacity * 100) : 100;

  const setConfigField = (key: string, val: unknown) => {
    onUpdate({ widgetConfig: { ...widgetConfig, [key]: val } });
  };

  return (
    <div className="wcp-panel" role="complementary" aria-label="Widget settings">
      {/* Header */}
      <div className="wcp-header">
        <div className="wcp-header__title">
          {entry ? (
            <>
              <span className="wcp-header__icon">{entry.icon}</span>
              <span>{entry.label}</span>
            </>
          ) : (
            <span>Widget Settings</span>
          )}
        </div>
        <button className="wcp-header__close" onClick={onClose} aria-label="Close panel" type="button">
          ✕
        </button>
      </div>

      <div className="wcp-body">
        {/* Appearance */}
        <section className="wcp-section">
          <div className="wcp-section__heading">Appearance</div>

          {node.type === "widget" && (
            <>
              {/* Skin */}
              <div className="wcp-sublabel">Style</div>
              <div className="wcp-skin-tiles">
                {SKINS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`wcp-skin-tile${currentSkin === s.value ? " wcp-skin-tile--active" : ""}`}
                    onClick={() => onUpdate({ widgetSkin: s.value })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Size */}
              <div className="wcp-sublabel">Size</div>
              <div className="wcp-size-buttons">
                {SIZES.map((sz) => (
                  <button
                    key={sz.value}
                    type="button"
                    className={`wcp-size-btn${currentVariant === sz.value ? " wcp-size-btn--active" : ""}`}
                    onClick={() => onUpdate({ widgetVariant: sz.value })}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Opacity */}
          <div className="wcp-field">
            <div className="wcp-field__row-between">
              <label className="wcp-field__label" htmlFor={`wcp-opacity-${node.id}`}>
                Opacity
              </label>
              <span className="wcp-field__value-badge">{currentOpacity}%</span>
            </div>
            <input
              id={`wcp-opacity-${node.id}`}
              type="range"
              min={5}
              max={100}
              value={currentOpacity}
              className="wcp-slider"
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
            />
          </div>
        </section>

        {/* Widget-specific settings */}
        {entry?.configFields && entry.configFields.length > 0 && (
          <section className="wcp-section">
            <div className="wcp-section__heading">Settings</div>
            {entry.configFields.map((field) => (
              <ConfigField
                key={field.key}
                field={field}
                value={widgetConfig[field.key]}
                onChange={(val) => setConfigField(field.key, val)}
              />
            ))}
          </section>
        )}

        {/* Actions */}
        <section className="wcp-section wcp-section--actions">
          <button className="wcp-btn wcp-btn--secondary" type="button" onClick={onDuplicate}>
            Duplicate
          </button>
          <button className="wcp-btn wcp-btn--danger" type="button" onClick={onDelete}>
            Delete widget
          </button>
        </section>
      </div>
    </div>
  );
}
