import type { WidgetConfigField } from "../../dashboard/types";
import { getRegistryEntry } from "../../dashboard/widgetRegistry";
import type { CanvasNode } from "./CanvasDashboard";

interface Props {
  node: CanvasNode;
  onChange: (patch: Record<string, unknown>) => void;
}

function fieldValue(config: Record<string, unknown> | undefined, key: string): string {
  const raw = config?.[key];
  if (raw == null) return "";
  return String(raw);
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: WidgetConfigField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select" && field.options?.length) {
    return (
      <select
        className="canvas-widget-config__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <option value="">Default</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "color") {
    return (
      <input
        type="color"
        className="canvas-widget-config__color"
        value={value || "#5b8dff"}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  if (field.type === "toggle") {
    return (
      <label className="canvas-widget-config__toggle">
        <input
          type="checkbox"
          checked={value === "true" || value === "1"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <span>{value === "true" || value === "1" ? "On" : "Off"}</span>
      </label>
    );
  }

  return (
    <input
      type="text"
      className="canvas-widget-config__input"
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

export function CanvasWidgetConfigSection({ node, onChange }: Props) {
  if (node.type !== "widget" || !node.widgetKey) return null;

  const entry = getRegistryEntry(node.widgetKey);
  const fields = entry?.configFields ?? [];
  if (fields.length === 0) return null;

  const config = (node.widgetConfig ?? {}) as Record<string, unknown>;

  return (
    <div className="canvas-widget-config">
      {fields.map((field) => (
        <label key={field.key} className="canvas-widget-config__field">
          <span className="canvas-widget-config__label">{field.label}</span>
          <FieldControl
            field={field}
            value={fieldValue(config, field.key)}
            onChange={(v) => {
              const next = { ...config, [field.key]: v };
              if (field.type === "text" && !v.trim()) delete next[field.key];
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}
