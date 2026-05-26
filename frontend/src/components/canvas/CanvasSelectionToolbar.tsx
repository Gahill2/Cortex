import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CanvasNode } from "./CanvasDashboard";
import { BACKDROP_COLORS, DEFAULT_BACKDROP_COLOR } from "./backdropColors";
import { buildWidgetRenderStyle } from "./widgetRenderStyle";
import { WIDGET_SKINS, type WidgetSkin } from "./widgetSkins";
import { getWidgetDisplayOptions } from "./widgetDisplayVariants";
import { getWidgetTypeDef, type WidgetSizeVariant } from "./widgetVariants";
import { WidgetVariantPicker } from "./WidgetVariantPicker";

export type WidgetStylePatch = {
  variant?: WidgetSizeVariant;
  skin?: WidgetSkin;
  display?: string;
};

export type BackdropStylePatch = Partial<
  Pick<
    CanvasNode,
    "backdropColor" | "backdropOpacity" | "backdropRadius" | "backdropBorderWidth" | "backdropBorderColor"
  >
>;

export type GeometryPatch = Partial<Pick<CanvasNode, "x" | "y" | "w" | "h" | "rotation">>;

export type AppearancePatch = Partial<Pick<CanvasNode, "opacity" | "cornerRadius">>;

interface Props {
  node: CanvasNode;
  onGeometryChange?: (patch: GeometryPatch) => void;
  onAppearanceChange?: (patch: AppearancePatch) => void;
  onWidgetStyleChange?: (patch: WidgetStylePatch) => void;
  onBackdropChange?: (patch: BackdropStylePatch) => void;
  onBringForward?: () => void;
  onSendForward?: () => void;
  onSendBackward?: () => void;
  onSendToBack?: () => void;
  onDuplicate?: () => void;
  onRemove: () => void;
  onClearSelection?: () => void;
}

function ToolbarDivider() {
  return <span className="canvas-selection-toolbar__divider" aria-hidden />;
}

function ToolbarLabel({ children }: { children: string }) {
  return <span className="canvas-selection-toolbar__label">{children}</span>;
}

function ToolbarBtn({
  title,
  active,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`canvas-selection-toolbar__btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="canvas-selection-toolbar__num">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </label>
  );
}

export function CanvasSelectionToolbar({
  node,
  onGeometryChange,
  onAppearanceChange,
  onWidgetStyleChange,
  onBackdropChange,
  onBringForward,
  onSendForward,
  onSendBackward,
  onSendToBack,
  onDuplicate,
  onRemove,
  onClearSelection,
}: Props) {
  const [aspectLocked, setAspectLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(() => (node.h > 0 ? node.w / node.h : 1));
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setAspectRatio(node.h > 0 ? node.w / node.h : 1);
    setDetailsOpen(false);
  }, [node.id, node.w, node.h]);

  const widgetDef =
    node.type === "widget" && node.widgetKey ? getWidgetTypeDef(node.widgetKey) : undefined;
  const widgetStyle =
    node.type === "widget" && node.widgetKey
      ? buildWidgetRenderStyle(node.widgetKey, node.widgetVariant, node.widgetSkin, node.widgetDisplay)
      : null;
  const displays =
    node.type === "widget" && node.widgetKey ? getWidgetDisplayOptions(node.widgetKey) : [];
  const showLayout = displays.length > 1;

  const title =
    node.type === "widget" && widgetDef
      ? widgetDef.label
      : node.type === "backdrop"
        ? "Color panel"
        : node.title ?? node.type;

  const applySize = useCallback(
    (patch: { w?: number; h?: number }) => {
      if (!onGeometryChange) return;
      if (aspectLocked && patch.w !== undefined && patch.h === undefined) {
        onGeometryChange({ w: patch.w, h: Math.max(1, Math.round(patch.w / aspectRatio)) });
        return;
      }
      if (aspectLocked && patch.h !== undefined && patch.w === undefined) {
        onGeometryChange({ h: patch.h, w: Math.max(1, Math.round(patch.h * aspectRatio)) });
        return;
      }
      onGeometryChange(patch);
    },
    [aspectLocked, aspectRatio, onGeometryChange],
  );

  const layerOpacity =
    node.type === "backdrop" ? (node.backdropOpacity ?? 0.45) : (node.opacity ?? 1);
  const cornerRadius =
    node.type === "backdrop" ? (node.backdropRadius ?? 16) : (node.cornerRadius ?? 0);
  const rotation = node.rotation ?? 0;

  const isWidget = node.type === "widget" && node.widgetKey && widgetStyle && onWidgetStyleChange;
  const hasAdvanced =
    Boolean(onGeometryChange) ||
    Boolean(onAppearanceChange) ||
    Boolean(onBackdropChange) ||
    Boolean(onBringForward) ||
    (isWidget && showLayout);

  return (
    <div
      className={`canvas-selection-toolbar${detailsOpen ? " canvas-selection-toolbar--expanded" : ""}`}
      role="toolbar"
      aria-label={`Edit ${title}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="canvas-selection-toolbar__primary">
      <div className="canvas-selection-toolbar__title-block">
        <span className="canvas-selection-toolbar__title">{title}</span>
        <span className="canvas-selection-toolbar__meta">
          {Math.round(node.w)}×{Math.round(node.h)}
          {detailsOpen ? ` · ${Math.round(node.x)}, ${Math.round(node.y)}` : null}
        </span>
      </div>

      {isWidget ? (
        <>
          <ToolbarDivider />
          <div className="canvas-selection-toolbar__section">
            <ToolbarLabel>Size</ToolbarLabel>
            <WidgetVariantPicker
              widgetKey={node.widgetKey!}
              selected={widgetStyle!.variant}
              onSelect={(variant) => onWidgetStyleChange!({ variant })}
            />
          </div>
          <ToolbarDivider />
          <div className="canvas-selection-toolbar__section">
            <ToolbarLabel>Design</ToolbarLabel>
            <div className="canvas-selection-toolbar__skin-row" role="radiogroup" aria-label="Widget design">
              {WIDGET_SKINS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={widgetStyle!.skin === s.id}
                  title={`${s.label} — ${s.hint}`}
                  className={`canvas-selection-toolbar__skin-btn${widgetStyle!.skin === s.id ? " is-active" : ""}`}
                  onClick={() => onWidgetStyleChange!({ skin: s.id })}
                >
                  <span
                    className={`widget-style-picker__skin-swatch widget-style-picker__skin-swatch--${s.id}`}
                    aria-hidden
                  />
                  <span className="canvas-selection-toolbar__skin-text">{s.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {hasAdvanced ? (
        <ToolbarBtn
          title={detailsOpen ? "Hide position, appearance, and layers" : "Show position, appearance, and layers"}
          active={detailsOpen}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <span className="canvas-selection-toolbar__details-label">
            {detailsOpen ? "Less" : "More"}
          </span>
        </ToolbarBtn>
      ) : null}

      <div className="canvas-selection-toolbar__actions">
        {onDuplicate ? (
          <ToolbarBtn title="Duplicate" onClick={onDuplicate}>
            ⧉
          </ToolbarBtn>
        ) : null}
        <ToolbarBtn title="Delete" danger onClick={onRemove}>
          ⌫
        </ToolbarBtn>
        {onClearSelection ? (
          <ToolbarBtn title="Deselect" onClick={onClearSelection}>
            ✕
          </ToolbarBtn>
        ) : null}
      </div>
      </div>

      {detailsOpen && hasAdvanced ? (
      <div className="canvas-selection-toolbar__details">
      {onGeometryChange ? (
        <>
          <ToolbarDivider />
          <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--geometry">
            <ToolbarLabel>Position</ToolbarLabel>
            <div className="canvas-selection-toolbar__geometry-grid">
              <NumField label="X" value={node.x} step={1} onChange={(x) => onGeometryChange({ x })} />
              <NumField label="Y" value={node.y} step={1} onChange={(y) => onGeometryChange({ y })} />
              <NumField label="W" value={node.w} min={node.type === "backdrop" ? 48 : 120} step={1} onChange={(w) => applySize({ w })} />
              <NumField label="H" value={node.h} min={node.type === "backdrop" ? 48 : 80} step={1} onChange={(h) => applySize({ h })} />
            </div>
            <ToolbarBtn
              title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
              active={aspectLocked}
              onClick={() => {
                setAspectRatio(node.h > 0 ? node.w / node.h : 1);
                setAspectLocked((v) => !v);
              }}
            >
              {aspectLocked ? "◆" : "◇"}
            </ToolbarBtn>
            <NumField
              label="°"
              value={rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(rotation) => onGeometryChange({ rotation })}
            />
          </div>
        </>
      ) : null}

      <ToolbarDivider />

      <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--appearance">
        <ToolbarLabel>Appearance</ToolbarLabel>
        <label className="canvas-selection-toolbar__slider canvas-selection-toolbar__slider--compact">
          <span>Opacity</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={layerOpacity}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (node.type === "backdrop" && onBackdropChange) {
                onBackdropChange({ backdropOpacity: v });
              } else if (onAppearanceChange) {
                onAppearanceChange({ opacity: v });
              }
            }}
          />
        </label>
        <label className="canvas-selection-toolbar__slider canvas-selection-toolbar__slider--compact">
          <span>Radius</span>
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={cornerRadius}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (node.type === "backdrop" && onBackdropChange) {
                onBackdropChange({ backdropRadius: v });
              } else if (onAppearanceChange) {
                onAppearanceChange({ cornerRadius: v });
              }
            }}
          />
        </label>
      </div>

      {isWidget && showLayout ? (
            <>
              <ToolbarDivider />
              <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--layout">
                <ToolbarLabel>Layout</ToolbarLabel>
                <div className="canvas-selection-toolbar__layout-row" role="radiogroup" aria-label="Widget layout">
                  {displays.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={widgetStyle!.display === d.id}
                      title={d.description ?? d.label}
                      className={`canvas-selection-toolbar__chip${widgetStyle!.display === d.id ? " is-active" : ""}`}
                      onClick={() => onWidgetStyleChange!({ display: d.id })}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
      ) : null}

      {node.type === "backdrop" && onBackdropChange ? (
        <>
          <ToolbarDivider />
          <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--backdrop">
            <ToolbarLabel>Fill</ToolbarLabel>
            <div className="canvas-selection-toolbar__swatches">
              {BACKDROP_COLORS.slice(0, 12).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`canvas-selection-toolbar__swatch${(node.backdropColor ?? DEFAULT_BACKDROP_COLOR) === c ? " is-active" : ""}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => onBackdropChange({ backdropColor: c })}
                />
              ))}
              <label className="canvas-selection-toolbar__color-input" title="Custom color">
                <input
                  type="color"
                  value={node.backdropColor ?? node.color ?? DEFAULT_BACKDROP_COLOR}
                  onChange={(e) => onBackdropChange({ backdropColor: e.target.value })}
                />
              </label>
            </div>
          </div>

          <ToolbarDivider />

          <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--sliders">
            <label className="canvas-selection-toolbar__slider">
              <span>Stroke</span>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={node.backdropBorderWidth ?? 0}
                onChange={(e) => onBackdropChange({ backdropBorderWidth: Number(e.target.value) })}
              />
            </label>
          </div>
        </>
      ) : null}

      <ToolbarDivider />

      <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--layers">
        <ToolbarLabel>Layers</ToolbarLabel>
        <div className="canvas-selection-toolbar__layer-row">
          <ToolbarBtn title="Send backward" onClick={() => onSendBackward?.()} disabled={!onSendBackward}>
            ↓
          </ToolbarBtn>
          <ToolbarBtn title="Bring forward" onClick={() => onBringForward?.()} disabled={!onBringForward}>
            ↑
          </ToolbarBtn>
          <ToolbarBtn title="Send to back" onClick={() => onSendToBack?.()} disabled={!onSendToBack}>
            ⇊
          </ToolbarBtn>
          <ToolbarBtn title="Bring to front" onClick={() => onSendForward?.()} disabled={!onSendForward}>
            ⇈
          </ToolbarBtn>
        </div>
      </div>

      </div>
      ) : null}
    </div>
  );
}
