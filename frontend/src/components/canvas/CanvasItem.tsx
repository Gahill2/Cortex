import type { ReactNode } from "react";
import type { WidgetRenderStyle } from "./widgetRenderStyle";
import { useState } from "react";
import type { CanvasNode } from "./CanvasDashboard";
import { isInteractiveCanvasTarget, prepareCanvasPointerGesture } from "./canvasPointer";
import { ScaledCanvasBody, canvasItemBaseSize } from "./ScaledCanvasBody";
import { WidgetStylePicker } from "./WidgetStylePicker";
import { buildWidgetRenderStyle } from "./widgetRenderStyle";
import type { WidgetSkin } from "./widgetSkins";
import {
  getVariantPreset,
  getWidgetTypeDef,
  type WidgetSizeVariant,
} from "./widgetVariants";

import { BACKDROP_COLORS, DEFAULT_BACKDROP_COLOR } from "./backdropColors";

export type BackdropStylePatch = Partial<
  Pick<
    CanvasNode,
    "backdropColor" | "backdropOpacity" | "backdropRadius" | "backdropBorderWidth" | "backdropBorderColor"
  >
>;

interface Props {
  node: CanvasNode;
  widgets: Record<string, ReactNode>;
  renderWidget?: (widgetKey: string, style: WidgetRenderStyle) => ReactNode;
  isSelected?: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onRemove: () => void;
  onContentChange: (content: string) => void;
  onTitleChange?: (title: string) => void;
  onWidgetStyleChange?: (patch: {
    variant?: WidgetSizeVariant;
    skin?: WidgetSkin;
    display?: string;
  }) => void;
  onBackdropChange?: (patch: BackdropStylePatch) => void;
  onSendToBack?: () => void;
}

export function CanvasItem({
  node,
  widgets,
  renderWidget,
  isSelected,
  onDragStart,
  onResizeStart,
  onRemove,
  onContentChange,
  onTitleChange,
  onWidgetStyleChange,
  onBackdropChange,
  onSendToBack,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const widgetStyle =
    node.type === "widget" && node.widgetKey
      ? buildWidgetRenderStyle(node.widgetKey, node.widgetVariant, node.widgetSkin, node.widgetDisplay)
      : null;
  const widgetVariant = widgetStyle?.variant ?? "medium";

  const base =
    node.type === "widget" && node.widgetKey
      ? {
          w: getVariantPreset(node.widgetKey, widgetVariant).w,
          h: getVariantPreset(node.widgetKey, widgetVariant).h,
        }
      : canvasItemBaseSize(node.type);

  const widgetDef = node.widgetKey ? getWidgetTypeDef(node.widgetKey) : undefined;
  const variantPreset = node.widgetKey ? getVariantPreset(node.widgetKey, widgetVariant) : null;

  const showChrome = hovered || isSelected;
  const isBackdrop = node.type === "backdrop";
  const isWidget = node.type === "widget";

  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (node.type === "note" || node.type === "custom") return;
    if (isInteractiveCanvasTarget(e.target)) return;
    prepareCanvasPointerGesture(e);
    onDragStart(e);
  };

  const wrapScaled = (content: ReactNode, className?: string) => (
    <ScaledCanvasBody baseWidth={base.w} baseHeight={base.h} className={className}>
      {content}
    </ScaledCanvasBody>
  );

  const resolveWidgetContent = () => {
    if (!node.widgetKey) return null;
    if (renderWidget && widgetStyle) return renderWidget(node.widgetKey, widgetStyle);
    return widgets[node.widgetKey] ?? null;
  };

  const renderBackdropFill = () => {
    const fill = node.backdropColor ?? node.color ?? DEFAULT_BACKDROP_COLOR;
    const opacity = node.backdropOpacity ?? 0.45;
    const radius = node.backdropRadius ?? 16;
    const borderW = node.backdropBorderWidth ?? 0;
    const borderC = node.backdropBorderColor ?? "rgba(255,255,255,0.18)";

    return (
      <div
        className="canvas-item__backdrop-fill"
        style={{
          background: fill,
          opacity,
          borderRadius: radius,
          border: borderW > 0 ? `${borderW}px solid ${borderC}` : undefined,
        }}
        onPointerDown={onDragStart}
      />
    );
  };

  const renderContent = () => {
    switch (node.type) {
      case "backdrop":
        return renderBackdropFill();
      case "widget": {
        const content = resolveWidgetContent();
        const layoutClass = variantPreset ? `canvas-item__widget--${variantPreset.layout}` : "";
        return (
          <div
            className={`canvas-item__widget canvas-item__widget--fill canvas-item__widget--${widgetVariant} ${layoutClass}`.trim()}
          >
            {content ?? (
              <div className="canvas-item__placeholder">Widget: {node.widgetKey}</div>
            )}
          </div>
        );
      }
      case "image":
        return (
          <div className="canvas-item__image-wrap" onDragStart={(e) => e.preventDefault()}>
            <img
              src={node.imageUrl}
              alt=""
              className="canvas-item__image"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
        );
      case "text":
        return wrapScaled(
          <div className="canvas-item__text">
            <p>{node.content}</p>
          </div>,
        );
      case "note":
        return wrapScaled(
          <div className="canvas-item__note">
            <textarea
              className="canvas-item__note-input"
              value={node.content ?? ""}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Type your note..."
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>,
        );
      case "custom":
        return wrapScaled(
          <div className="canvas-item__custom" style={{ borderTop: `3px solid ${node.color ?? "#5b8dff"}` }}>
            <div className="canvas-item__custom-content" onPointerDown={(e) => e.stopPropagation()}>
              <textarea
                className="canvas-item__custom-text"
                value={node.content ?? ""}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Write anything..."
              />
            </div>
          </div>,
        );
      case "embed":
        return wrapScaled(
          <div className="canvas-item__embed">
            <iframe
              src={node.embedUrl}
              className="canvas-item__embed-frame"
              sandbox="allow-scripts allow-same-origin allow-popups"
              title={node.title ?? "Embed"}
              loading="lazy"
            />
          </div>,
        );
      default:
        return null;
    }
  };

  const typeLabel =
    node.type === "widget" && widgetDef
      ? `${widgetDef.label} · ${variantPreset?.shortLabel ?? "M"}`
      : node.type === "widget"
        ? node.widgetKey
        : node.type === "backdrop"
          ? "Color panel"
          : node.title ?? node.type;

  const renderBackdropChrome = () => {
    if (!onBackdropChange) return null;
    const fill = node.backdropColor ?? node.color ?? DEFAULT_BACKDROP_COLOR;
    const opacity = node.backdropOpacity ?? 0.45;
    const radius = node.backdropRadius ?? 16;
    const borderW = node.backdropBorderWidth ?? 0;

    return (
      <div
        className={`canvas-item__backdrop-chrome${showChrome ? " canvas-item__backdrop-chrome--visible" : ""}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="canvas-item__backdrop-chrome-row">
          <div className="canvas-item__backdrop-swatches">
            {BACKDROP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`canvas-item__backdrop-swatch${fill === c ? " is-active" : ""}`}
                style={{ background: c }}
                title={c}
                onClick={() => onBackdropChange({ backdropColor: c })}
              />
            ))}
            <label className="canvas-item__backdrop-color-input" title="Custom color">
              <input
                type="color"
                value={fill}
                onChange={(e) => onBackdropChange({ backdropColor: e.target.value })}
              />
            </label>
          </div>
          <button type="button" className="canvas-item__close" onClick={onRemove} title="Remove">
            ×
          </button>
        </div>
        <div className="canvas-item__backdrop-chrome-row canvas-item__backdrop-chrome-row--sliders">
          <label className="canvas-item__backdrop-slider">
            <span>Opacity</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onBackdropChange({ backdropOpacity: Number(e.target.value) })}
            />
          </label>
          <label className="canvas-item__backdrop-slider">
            <span>Radius</span>
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={radius}
              onChange={(e) => onBackdropChange({ backdropRadius: Number(e.target.value) })}
            />
          </label>
          <label className="canvas-item__backdrop-slider">
            <span>Stroke</span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={borderW}
              onChange={(e) => onBackdropChange({ backdropBorderWidth: Number(e.target.value) })}
            />
          </label>
          {onSendToBack && (
            <button type="button" className="canvas-item__backdrop-back" onClick={onSendToBack} title="Send to back">
              ↓
            </button>
          )}
        </div>
      </div>
    );
  };

  if (isBackdrop) {
    return (
      <div
        className={`canvas-item canvas-item--backdrop${hovered ? " canvas-item--hovered" : ""}${isSelected ? " canvas-item--selected" : ""}`}
        style={{
          left: node.x,
          top: node.y,
          width: node.w,
          height: node.h,
          zIndex: node.zIndex,
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <div className="canvas-item__body canvas-item__body--backdrop">{renderContent()}</div>
        {renderBackdropChrome()}
        <div className="canvas-item__resize" onPointerDown={onResizeStart}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="6" cy="10" r="1.5" />
            <circle cx="10" cy="6" r="1.5" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`canvas-item canvas-item--${node.type}${hovered ? " canvas-item--hovered" : ""}${isSelected ? " canvas-item--selected" : ""}${node.type === "widget" ? ` canvas-item--variant-${widgetVariant}` : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        zIndex: node.zIndex,
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        if (!isSelected) setShowStylePicker(false);
      }}
    >
      <div className="canvas-item__header" onPointerDown={onDragStart}>
        <span className="canvas-item__drag-dots" aria-hidden>⋮⋮</span>
        {(node.type === "custom" || node.type === "embed") && onTitleChange ? (
          <input
            className="canvas-item__title-input"
            value={node.title ?? ""}
            onChange={(e) => onTitleChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Untitled"
          />
        ) : (
          <span className="canvas-item__type-label">{typeLabel}</span>
        )}
        {node.type === "widget" && onWidgetStyleChange && node.widgetKey && widgetStyle && (
          <button
            type="button"
            className={`canvas-item__style-btn${showStylePicker ? " canvas-item__style-btn--open" : ""}`}
            title="Change size, design, and layout"
            onClick={(e) => {
              e.stopPropagation();
              setShowStylePicker((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Style
          </button>
        )}
        <button type="button" className="canvas-item__close" onClick={onRemove} title="Remove">
          ×
        </button>
      </div>

      {showStylePicker && node.type === "widget" && node.widgetKey && onWidgetStyleChange && widgetStyle && (
        <div className="canvas-item__style-panel">
          <WidgetStylePicker
            variant="panel"
            widgetKey={node.widgetKey}
            size={widgetVariant}
            skin={widgetStyle.skin}
            display={widgetStyle.display}
            onSize={(v) => onWidgetStyleChange({ variant: v })}
            onSkin={(skin) => onWidgetStyleChange({ skin })}
            onDisplay={(display) => onWidgetStyleChange({ display })}
          />
        </div>
      )}

      <div className="canvas-item__body" onPointerDown={handleBodyPointerDown}>
        {renderContent()}
      </div>

      <div className="canvas-item__resize" onPointerDown={onResizeStart}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="6" cy="10" r="1.5" />
          <circle cx="10" cy="6" r="1.5" />
        </svg>
      </div>

      {!isWidget ? <div className="canvas-item__frame" /> : null}
    </div>
  );
}
