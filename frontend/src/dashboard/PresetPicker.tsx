import { useState } from "react";
import { PRESET_LAYOUTS, type LayoutPreset } from "./presetLayouts";
import type { CanvasNode } from "../components/canvas/CanvasDashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user picks a preset — receives ready-to-use nodes with fresh IDs */
  onApply: (nodes: CanvasNode[]) => void;
}

function applyPreset(preset: LayoutPreset): CanvasNode[] {
  return preset.nodes.map((n, i) => ({
    ...n,
    id: crypto.randomUUID(),
    zIndex: i + 1,
  }));
}

/** Mini preview block for a node — colored rectangle proportional to widget size */
function MiniBlock({ node, scale }: { node: Omit<CanvasNode, "id">; scale: number }) {
  const colors: Record<string, string> = {
    clock: "#5b8dff",
    tasks: "#3be8ad",
    calendar: "#f5a623",
    mail: "#ec4899",
    weather: "#38bdf8",
    pomodoro: "#ff5f5f",
    today: "#7c9dff",
    quote: "#a855f7",
    system: "#64748b",
    notes: "#a855f7",
    habits: "#84cc16",
    spotify: "#1db954",
    ai: "#5b8dff",
    automations: "#06b6d4",
  };
  const color = node.widgetKey ? (colors[node.widgetKey] ?? "#888") : "#888";

  // Find bounding box across all preset nodes to compute offsets — handled by parent
  return (
    <div
      style={{
        position: "absolute",
        left: node.x * scale,
        top: node.y * scale,
        width: node.w * scale,
        height: node.h * scale,
        background: color,
        borderRadius: 3,
        opacity: 0.8,
      }}
    />
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: LayoutPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  // Compute bounding box of all nodes to scale preview
  const xs = preset.nodes.map((n) => n.x);
  const ys = preset.nodes.map((n) => n.y);
  const x2s = preset.nodes.map((n) => n.x + n.w);
  const y2s = preset.nodes.map((n) => n.y + n.h);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...x2s);
  const maxY = Math.max(...y2s);
  const bw = maxX - minX;
  const bh = maxY - minY;
  const PREVIEW_W = 180;
  const PREVIEW_H = 100;
  const scale = Math.min(PREVIEW_W / bw, PREVIEW_H / bh) * 0.85;
  const offsetX = (PREVIEW_W - bw * scale) / 2 - minX * scale;
  const offsetY = (PREVIEW_H - bh * scale) / 2 - minY * scale;

  return (
    <button
      type="button"
      className={`preset-picker__card${selected ? " preset-picker__card--selected" : ""}`}
      onClick={onSelect}
    >
      <div
        className="preset-picker__preview"
        style={{ width: PREVIEW_W, height: PREVIEW_H, position: "relative" }}
      >
        {preset.nodes.map((n, i) => (
          <MiniBlock
            key={i}
            node={{ ...n, x: n.x + offsetX / scale, y: n.y + offsetY / scale }}
            scale={scale}
          />
        ))}
      </div>
      <div className="preset-picker__card-body">
        <span className="preset-picker__icon">{preset.icon}</span>
        <div>
          <div className="preset-picker__name">{preset.name}</div>
          <div className="preset-picker__desc">{preset.description}</div>
        </div>
      </div>
    </button>
  );
}

export function PresetPicker({ open, onClose, onApply }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!open) return null;

  const handleApply = () => {
    const preset = PRESET_LAYOUTS.find((p) => p.id === selected);
    if (!preset) return;
    onApply(applyPreset(preset));
    onClose();
    setSelected(null);
  };

  const handleBlank = () => {
    onClose();
    setSelected(null);
  };

  return (
    <div className="preset-picker__overlay" onClick={handleBlank}>
      <div className="preset-picker__modal" onClick={(e) => e.stopPropagation()}>
        <div className="preset-picker__header">
          <h2 className="preset-picker__title">Choose a layout</h2>
          <p className="preset-picker__subtitle">
            Pick a preset to get started, or start with a blank canvas.
          </p>
        </div>
        <div className="preset-picker__grid">
          {PRESET_LAYOUTS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={selected === preset.id}
              onSelect={() => setSelected(preset.id)}
            />
          ))}
        </div>
        <div className="preset-picker__footer">
          <button type="button" className="preset-picker__btn-blank" onClick={handleBlank}>
            Start blank
          </button>
          <button
            type="button"
            className="preset-picker__btn-apply"
            disabled={!selected}
            onClick={handleApply}
          >
            Apply layout
          </button>
        </div>
      </div>
    </div>
  );
}
