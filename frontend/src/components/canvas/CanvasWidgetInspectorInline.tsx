import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CanvasNode } from "./CanvasDashboard";
import { BACKDROP_COLORS, DEFAULT_BACKDROP_COLOR } from "./backdropColors";
import { buildWidgetRenderStyle } from "./widgetRenderStyle";
import { WIDGET_SKINS, type WidgetSkin } from "./widgetSkins";
import { getWidgetDisplayOptions } from "./widgetDisplayVariants";
import { getRegistryEntry } from "../../dashboard/widgetRegistry";
import { getWidgetTypeDef } from "./widgetVariants";
import { CanvasWidgetConfigSection } from "./CanvasWidgetConfigSection";
import {
  type BoardTypography,
  resolveWidgetTypography,
  widgetHasOwnTypography,
} from "../../lib/uiCustomization";
import { TextSizePresetPicker } from "./TextSizePresetPicker";
import type {
  AppearancePatch,
  BackdropStylePatch,
  GeometryPatch,
  WidgetStylePatch,
} from "./CanvasSelectionToolbar";

interface Props {
  node: CanvasNode;
  boardTypography?: BoardTypography;
  onGeometryChange?: (patch: GeometryPatch) => void;
  onAppearanceChange?: (patch: AppearancePatch) => void;
  onWidgetStyleChange?: (patch: WidgetStylePatch) => void;
  onWidgetConfigChange?: (config: Record<string, unknown>) => void;
  onBackdropChange?: (patch: BackdropStylePatch) => void;
  onBringForward?: () => void;
  onSendForward?: () => void;
  onSendBackward?: () => void;
  onSendToBack?: () => void;
  onDuplicate?: () => void;
  onToggleLock?: () => void;
  onRemove: () => void;
  onClearSelection?: () => void;
}

function InspectorSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="canvas-widget-inspector__field">
      <span className="canvas-widget-inspector__field-label">{label}</span>
      <select
        className="canvas-widget-inspector__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </select>
    </label>
  );
}

function IconBtn({
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
      className={`canvas-widget-inspector__icon-btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
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

/** Compact Google Docs–style widget controls in the main toolbar row. */
export function CanvasWidgetInspectorInline({
  node,
  boardTypography = { textSizePx: 24, textScale: 1 },
  onGeometryChange,
  onAppearanceChange,
  onWidgetStyleChange,
  onWidgetConfigChange,
  onBackdropChange,
  onBringForward,
  onSendForward,
  onSendBackward,
  onSendToBack,
  onDuplicate,
  onToggleLock,
  onRemove,
  onClearSelection,
}: Props) {
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTextMenuOpen(false);
    setMoreMenuOpen(false);
  }, [node.id]);

  useEffect(() => {
    if (!textMenuOpen && !moreMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (textMenuOpen && textRef.current?.contains(t)) return;
      if (moreMenuOpen && moreRef.current?.contains(t)) return;
      setTextMenuOpen(false);
      setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [textMenuOpen, moreMenuOpen]);

  const widgetDef =
    node.type === "widget" && node.widgetKey ? getWidgetTypeDef(node.widgetKey) : undefined;
  const widgetStyle =
    node.type === "widget" && node.widgetKey
      ? buildWidgetRenderStyle(node.widgetKey, node.widgetVariant, node.widgetSkin, node.widgetDisplay)
      : null;
  const displays =
    node.type === "widget" && node.widgetKey ? getWidgetDisplayOptions(node.widgetKey) : [];
  const hasConfigFields = Boolean(
    node.type === "widget" &&
      node.widgetKey &&
      (getRegistryEntry(node.widgetKey)?.configFields?.length ?? 0) > 0,
  );

  const title =
    node.type === "widget" && widgetDef
      ? widgetDef.label
      : node.type === "backdrop"
        ? "Panel"
        : node.title ?? node.type;

  const locked = Boolean(node.locked);
  const layerOpacity =
    node.type === "backdrop" ? (node.backdropOpacity ?? 0.45) : (node.opacity ?? 1);
  const cornerRadius =
    node.type === "backdrop" ? (node.backdropRadius ?? 16) : (node.cornerRadius ?? 0);

  const typo = resolveWidgetTypography(node.widgetConfig, boardTypography);
  const hasOwnTypo = widgetHasOwnTypography(node.widgetConfig);

  return (
    <div
      className="canvas-widget-inspector"
      role="toolbar"
      aria-label={`Customize ${title}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="canvas-widget-inspector__title" title={title}>
        {title}
      </span>

      {node.type === "widget" && widgetStyle && onWidgetStyleChange && widgetDef ? (
        <>
          <InspectorSelect
            label="Size"
            value={widgetStyle.variant}
            onChange={(v) => onWidgetStyleChange({ variant: v as typeof widgetStyle.variant })}
          >
            {widgetDef.variants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </InspectorSelect>

          <InspectorSelect
            label="Style"
            value={widgetStyle.skin}
            onChange={(v) => onWidgetStyleChange({ skin: v as WidgetSkin })}
          >
            {WIDGET_SKINS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </InspectorSelect>

          {displays.length > 1 ? (
            <InspectorSelect
              label="Layout"
              value={widgetStyle.display}
              onChange={(v) => onWidgetStyleChange({ display: v })}
            >
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </InspectorSelect>
          ) : null}

          {onWidgetConfigChange ? (
            <div className="canvas-widget-inspector__menu-anchor" ref={textRef}>
              <button
                type="button"
                className={`canvas-widget-inspector__menu-btn${textMenuOpen ? " is-open" : ""}${hasOwnTypo ? " is-custom" : ""}`}
                onClick={() => {
                  setMoreMenuOpen(false);
                  setTextMenuOpen((o) => !o);
                }}
              >
                Text
                <span className="canvas-widget-inspector__chevron" aria-hidden />
              </button>
              {textMenuOpen ? (
                <div className="canvas-widget-inspector__menu canvas-widget-inspector__menu--text">
                  <TextSizePresetPicker
                    compact
                    textSizePx={typo.textSizePx}
                    textScale={typo.textScale}
                    inheritLabel="Board"
                    inheritActive={!hasOwnTypo}
                    onInherit={() => {
                      const next = { ...(node.widgetConfig ?? {}) };
                      delete next.textSizePx;
                      delete next.textScale;
                      delete next.typographyCustom;
                      onWidgetConfigChange(next);
                    }}
                    onTextSizePxChange={(px) =>
                      onWidgetConfigChange({
                        ...(node.widgetConfig ?? {}),
                        textSizePx: px,
                        typographyCustom: true,
                      })
                    }
                    onTextScaleChange={(scale) =>
                      onWidgetConfigChange({
                        ...(node.widgetConfig ?? {}),
                        textScale: scale,
                        typographyCustom: true,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="canvas-widget-inspector__menu-anchor" ref={moreRef}>
        <button
          type="button"
          className={`canvas-widget-inspector__menu-btn${moreMenuOpen ? " is-open" : ""}`}
          onClick={() => {
            setTextMenuOpen(false);
            setMoreMenuOpen((o) => !o);
          }}
        >
          More
          <span className="canvas-widget-inspector__chevron" aria-hidden />
        </button>
        {moreMenuOpen ? (
          <div className="canvas-widget-inspector__menu canvas-widget-inspector__menu--more">
            <div className="canvas-widget-inspector__menu-section">
              <span className="canvas-widget-inspector__menu-heading">Appearance</span>
              <label className="canvas-widget-inspector__slider">
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
              <label className="canvas-widget-inspector__slider">
                <span>Corner radius</span>
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

            {node.type === "backdrop" && onBackdropChange ? (
              <div className="canvas-widget-inspector__menu-section">
                <span className="canvas-widget-inspector__menu-heading">Fill</span>
                <div className="canvas-widget-inspector__swatches">
                  {BACKDROP_COLORS.slice(0, 10).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`canvas-widget-inspector__swatch${(node.backdropColor ?? DEFAULT_BACKDROP_COLOR) === c ? " is-active" : ""}`}
                      style={{ background: c }}
                      title={c}
                      onClick={() => onBackdropChange({ backdropColor: c })}
                    />
                  ))}
                  <label className="canvas-widget-inspector__color-input" title="Custom color">
                    <input
                      type="color"
                      value={node.backdropColor ?? node.color ?? DEFAULT_BACKDROP_COLOR}
                      onChange={(e) => onBackdropChange({ backdropColor: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {hasConfigFields && onWidgetConfigChange ? (
              <div className="canvas-widget-inspector__menu-section">
                <span className="canvas-widget-inspector__menu-heading">Options</span>
                <CanvasWidgetConfigSection node={node} onChange={onWidgetConfigChange} />
              </div>
            ) : null}

            <div className="canvas-widget-inspector__menu-section">
              <span className="canvas-widget-inspector__menu-heading">Layers</span>
              <div className="canvas-widget-inspector__layer-row">
                <IconBtn title="Send backward" disabled={!onSendBackward} onClick={() => onSendBackward?.()}>
                  ↓
                </IconBtn>
                <IconBtn title="Bring forward" disabled={!onBringForward} onClick={() => onBringForward?.()}>
                  ↑
                </IconBtn>
                <IconBtn title="Send to back" disabled={!onSendToBack} onClick={() => onSendToBack?.()}>
                  ⇊
                </IconBtn>
                <IconBtn title="Bring to front" disabled={!onSendForward} onClick={() => onSendForward?.()}>
                  ⇈
                </IconBtn>
              </div>
            </div>

            {onGeometryChange && !locked ? (
              <div className="canvas-widget-inspector__menu-section">
                <span className="canvas-widget-inspector__menu-heading">Position</span>
                <div className="canvas-widget-inspector__dims">
                  <span>
                    {Math.round(node.w)}×{Math.round(node.h)}
                  </span>
                  <span className="canvas-widget-inspector__dims-muted">
                    {Math.round(node.x)}, {Math.round(node.y)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <span className="canvas-widget-inspector__spacer" aria-hidden />

      <div className="canvas-widget-inspector__actions">
        {onToggleLock ? (
          <IconBtn
            title={locked ? "Unlock" : "Lock position"}
            active={locked}
            onClick={onToggleLock}
          >
            {locked ? "🔓" : "🔒"}
          </IconBtn>
        ) : null}
        {onDuplicate ? (
          <IconBtn title="Duplicate" disabled={locked} onClick={onDuplicate}>
            ⧉
          </IconBtn>
        ) : null}
        <IconBtn title="Delete" danger onClick={onRemove}>
          ⌫
        </IconBtn>
        {onClearSelection ? (
          <IconBtn title="Deselect" onClick={onClearSelection}>
            ✕
          </IconBtn>
        ) : null}
      </div>
    </div>
  );
}
