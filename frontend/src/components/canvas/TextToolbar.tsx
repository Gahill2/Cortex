import { useEffect, useRef } from "react";
import type { TextContent } from "./TextCanvasNode";
import { defaultTextContent } from "./TextCanvasNode";

const FONT_FAMILIES = [
  "Inter, sans-serif",
  "-apple-system, SF Pro, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Arial, sans-serif",
  "Helvetica Neue, sans-serif",
  "Roboto, sans-serif",
];

const FONT_FAMILY_LABELS: Record<string, string> = {
  "Inter, sans-serif": "Inter",
  "-apple-system, SF Pro, sans-serif": "SF Pro",
  "Georgia, serif": "Georgia",
  "Courier New, monospace": "Courier New",
  "Arial, sans-serif": "Arial",
  "Helvetica Neue, sans-serif": "Helvetica",
  "Roboto, sans-serif": "Roboto",
};

const LINE_HEIGHTS = [1, 1.25, 1.5, 1.75, 2];

interface Props {
  nodeRect: { x: number; y: number; w: number; h: number };
  pan: { x: number; y: number };
  zoom: number;
  textContent: TextContent;
  onUpdate: (patch: Partial<TextContent>) => void;
  containerRef: React.RefObject<HTMLElement>;
}

function cssColorToHex(color: string): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) return color;
  // For CSS variables or named colors, just return a fallback
  if (color.startsWith("var(") || color === "transparent") return "#e2e8f0";
  return color;
}

export function TextToolbar({ nodeRect, pan, zoom, textContent, onUpdate, containerRef }: Props) {
  const tc: TextContent = { ...defaultTextContent, ...textContent };
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Calculate position: centered above the node, clamped to viewport
  const nodeScreenX = nodeRect.x * zoom + pan.x;
  const nodeScreenY = nodeRect.y * zoom + pan.y;
  const nodeScreenW = nodeRect.w * zoom;

  const TOOLBAR_H = 44;
  const TOOLBAR_W = 560;
  const GAP = 8;

  const containerW = containerRef.current?.clientWidth ?? 800;
  const containerH = containerRef.current?.clientHeight ?? 600;

  let left = nodeScreenX + nodeScreenW / 2 - TOOLBAR_W / 2;
  let top = nodeScreenY - TOOLBAR_H - GAP;

  // Clamp horizontally
  left = Math.max(8, Math.min(containerW - TOOLBAR_W - 8, left));
  // If goes above container, place below node instead
  if (top < 8) {
    const nodeScreenH = nodeRect.h * zoom;
    top = nodeScreenY + nodeScreenH + GAP;
  }
  top = Math.max(8, Math.min(containerH - TOOLBAR_H - 8, top));

  const hexColor = cssColorToHex(tc.color);
  const hexBg = tc.background === "transparent" ? "#000000" : cssColorToHex(tc.background);

  return (
    <div
      ref={toolbarRef}
      className="text-toolbar"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Font family */}
      <select
        className="text-toolbar__select"
        value={tc.fontFamily}
        onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        title="Font family"
        style={{ minWidth: 80 }}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>{FONT_FAMILY_LABELS[f] ?? f}</option>
        ))}
      </select>

      <div className="text-toolbar__divider" />

      {/* Font size */}
      <input
        type="number"
        className="text-toolbar__number"
        min={8}
        max={200}
        value={tc.fontSize}
        onChange={(e) => onUpdate({ fontSize: Math.max(8, Math.min(200, Number(e.target.value))) })}
        title="Font size"
        style={{ width: 48 }}
      />

      <div className="text-toolbar__divider" />

      {/* Bold / Italic / Underline */}
      <button
        type="button"
        className={`text-toolbar__btn${tc.fontWeight >= 700 ? " text-toolbar__btn--active" : ""}`}
        title="Bold (Ctrl+B)"
        style={{ fontWeight: 700 }}
        onClick={() => onUpdate({ fontWeight: tc.fontWeight >= 700 ? 400 : 700 })}
      >
        B
      </button>
      <button
        type="button"
        className={`text-toolbar__btn${tc.fontStyle === "italic" ? " text-toolbar__btn--active" : ""}`}
        title="Italic (Ctrl+I)"
        style={{ fontStyle: "italic" }}
        onClick={() => onUpdate({ fontStyle: tc.fontStyle === "italic" ? "normal" : "italic" })}
      >
        I
      </button>
      <button
        type="button"
        className={`text-toolbar__btn${tc.textDecoration === "underline" ? " text-toolbar__btn--active" : ""}`}
        title="Underline (Ctrl+U)"
        style={{ textDecoration: "underline" }}
        onClick={() =>
          onUpdate({ textDecoration: tc.textDecoration === "underline" ? "none" : "underline" })
        }
      >
        U
      </button>

      <div className="text-toolbar__divider" />

      {/* Align */}
      <button
        type="button"
        className={`text-toolbar__btn${tc.align === "left" ? " text-toolbar__btn--active" : ""}`}
        title="Align left"
        onClick={() => onUpdate({ align: "left" })}
      >
        ≡
      </button>
      <button
        type="button"
        className={`text-toolbar__btn${tc.align === "center" ? " text-toolbar__btn--active" : ""}`}
        title="Align center"
        onClick={() => onUpdate({ align: "center" })}
      >
        ≡
      </button>
      <button
        type="button"
        className={`text-toolbar__btn${tc.align === "right" ? " text-toolbar__btn--active" : ""}`}
        title="Align right"
        onClick={() => onUpdate({ align: "right" })}
      >
        ≡
      </button>

      <div className="text-toolbar__divider" />

      {/* Text color */}
      <label className="text-toolbar__color-label" title="Text color">
        <span className="text-toolbar__color-swatch" style={{ background: hexColor }} />
        <input
          type="color"
          value={hexColor}
          onChange={(e) => onUpdate({ color: e.target.value })}
          style={{ opacity: 0, position: "absolute", width: 0, height: 0 }}
        />
      </label>

      <div className="text-toolbar__divider" />

      {/* Line height */}
      <select
        className="text-toolbar__select"
        value={tc.lineHeight}
        onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
        title="Line height"
        style={{ minWidth: 52 }}
      >
        {LINE_HEIGHTS.map((lh) => (
          <option key={lh} value={lh}>{lh}×</option>
        ))}
      </select>

      <div className="text-toolbar__divider" />

      {/* Letter spacing */}
      <input
        type="number"
        className="text-toolbar__number"
        min={-2}
        max={20}
        step={0.5}
        value={tc.letterSpacing}
        onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) })}
        title="Letter spacing (px)"
        style={{ width: 44 }}
      />

      <div className="text-toolbar__divider" />

      {/* Background color */}
      <label className="text-toolbar__color-label" title="Background color">
        <span
          className="text-toolbar__color-swatch text-toolbar__color-swatch--bg"
          style={{
            background: tc.background === "transparent" ? "transparent" : hexBg,
            border: tc.background === "transparent" ? "1.5px dashed var(--border)" : undefined,
          }}
        />
        <input
          type="color"
          value={hexBg}
          onChange={(e) => onUpdate({ background: e.target.value })}
          style={{ opacity: 0, position: "absolute", width: 0, height: 0 }}
        />
      </label>
      {tc.background !== "transparent" && (
        <button
          type="button"
          className="text-toolbar__btn"
          title="Remove background"
          style={{ fontSize: 10 }}
          onClick={() => onUpdate({ background: "transparent" })}
        >
          ✕
        </button>
      )}
    </div>
  );
}
