import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CanvasNode } from "./CanvasDashboard";
import { BACKDROP_COLORS, DEFAULT_BACKDROP_COLOR } from "./backdropColors";
import { buildWidgetRenderStyle } from "./widgetRenderStyle";
import { WIDGET_SKINS, type WidgetSkin } from "./widgetSkins";
import { getWidgetDisplayOptions } from "./widgetDisplayVariants";
import { getRegistryEntry } from "../../dashboard/widgetRegistry";
import { getWidgetTypeDef, type WidgetSizeVariant } from "./widgetVariants";
import { WidgetVariantPicker } from "./WidgetVariantPicker";
import { CanvasWidgetConfigSection } from "./CanvasWidgetConfigSection";
import {
  type BoardTypography,
  resolveWidgetTypography,
  widgetHasOwnTypography,
} from "../../lib/uiCustomization";
import { TextSizePresetPicker } from "./TextSizePresetPicker";

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
  /** Board default typography (for widget “Board” preset). */
  boardTypography?: BoardTypography;
  /** Inline segment inside unified toolbar */
  embedded?: boolean;
  /** In edit mode, show size/design/options without extra clicks */
  preferExpanded?: boolean;
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

function WidgetTypographyControl({
  widgetConfig,
  board,
  onChange,
  onClearOverride,
}: {
  widgetConfig: Record<string, unknown> | undefined;
  board: BoardTypography;
  onChange: (patch: Record<string, unknown>) => void;
  onClearOverride: () => void;
}) {
  const typo = resolveWidgetTypography(widgetConfig, board);
  const hasOwn = widgetHasOwnTypography(widgetConfig);
  return (
    <div className="canvas-selection-toolbar__widget-text">
      <TextSizePresetPicker
        className="canvas-selection-toolbar__text-presets"
        compact={false}
        textSizePx={typo.textSizePx}
        textScale={typo.textScale}
        inheritLabel="Board"
        inheritActive={!hasOwn}
        onInherit={onClearOverride}
        onTextSizePxChange={(px) => onChange({ textSizePx: px, typographyCustom: true })}
        onTextScaleChange={(scale) => onChange({ textScale: scale, typographyCustom: true })}
      />
    </div>
  );
}

export function CanvasSelectionToolbar({
  node,
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
  boardTypography = { textSizePx: 24, textScale: 1 },
  embedded = false,
  preferExpanded = false,
}: Props) {
  const [aspectLocked, setAspectLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(() => (node.h > 0 ? node.w / node.h : 1));
  const hasConfigFields = Boolean(
    node.type === "widget" &&
      node.widgetKey &&
      (getRegistryEntry(node.widgetKey)?.configFields?.length ?? 0) > 0,
  );
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

  const locked = Boolean(node.locked);

  const applySize = useCallback(
    (patch: { w?: number; h?: number }) => {
      if (!onGeometryChange || locked) return;
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
    [aspectLocked, aspectRatio, onGeometryChange, locked],
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

  const panelStack = embedded && preferExpanded;

  const titleBlock = (
    <div className="canvas-selection-toolbar__title-block">
      <span className="canvas-selection-toolbar__title">{title}</span>
      <span className="canvas-selection-toolbar__meta">
        {Math.round(node.w)}×{Math.round(node.h)}
        {!embedded && detailsOpen ? ` · ${Math.round(node.x)}, ${Math.round(node.y)}` : null}
      </span>
    </div>
  );

  const actionsBlock = (
    <div className="canvas-selection-toolbar__actions">
      {onToggleLock ? (
        <ToolbarBtn
          title={locked ? "Unlock (allow move & resize)" : "Lock position (stays put while editing)"}
          active={locked}
          onClick={onToggleLock}
        >
          {locked ? "🔓" : "🔒"}
        </ToolbarBtn>
      ) : null}
      {onDuplicate ? (
        <ToolbarBtn title="Duplicate" onClick={onDuplicate} disabled={locked}>
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
  );

  const moreBtn = hasAdvanced ? (
    <ToolbarBtn
      title={detailsOpen ? "Hide position, appearance, and layers" : "Show position, appearance, and layers"}
      active={detailsOpen}
      onClick={() => setDetailsOpen((v) => !v)}
    >
      <span className="canvas-selection-toolbar__details-label">
        {detailsOpen ? "Less" : "More"}
      </span>
    </ToolbarBtn>
  ) : null;

  const widgetSizeSection = isWidget ? (
    <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--size">
      <ToolbarLabel>Size</ToolbarLabel>
      <WidgetVariantPicker
        widgetKey={node.widgetKey!}
        selected={widgetStyle!.variant}
        onSelect={(variant) => onWidgetStyleChange!({ variant })}
      />
    </div>
  ) : null;

  const widgetDesignSection = isWidget ? (
    <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--design">
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
  ) : null;

  const widgetTextScaleSection =
    isWidget && onWidgetConfigChange ? (
      <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--text-scale">
        <ToolbarLabel>This widget</ToolbarLabel>
        <WidgetTypographyControl
          widgetConfig={node.widgetConfig}
          board={boardTypography}
          onChange={(patch) =>
            onWidgetConfigChange({
              ...(node.widgetConfig ?? {}),
              ...patch,
            })
          }
          onClearOverride={() => {
            const next = { ...(node.widgetConfig ?? {}) };
            delete next.textScale;
            delete next.textSizePx;
            delete next.typographyCustom;
            onWidgetConfigChange(next);
          }}
        />
      </div>
    ) : null;

  const widgetConfigSection =
    isWidget && onWidgetConfigChange && hasConfigFields ? (
      <div className="canvas-selection-toolbar__section canvas-selection-toolbar__section--config">
        <ToolbarLabel>Options</ToolbarLabel>
        <CanvasWidgetConfigSection node={node} onChange={onWidgetConfigChange} />
      </div>
    ) : null;

  const detailsPanel = detailsOpen && hasAdvanced ? (
    <div className="canvas-selection-toolbar__details">
      {onGeometryChange && !locked ? (
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
      ) : locked ? (
        <>
          <ToolbarDivider />
          <p className="canvas-selection-toolbar__locked-hint">Locked — unlock to move or resize.</p>
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
  ) : null;

  return (
    <div
      className={`canvas-selection-toolbar${detailsOpen ? " canvas-selection-toolbar--expanded" : ""}${embedded ? " canvas-selection-toolbar--embedded" : ""}${panelStack ? " canvas-selection-toolbar--panel" : ""}`}
      role="toolbar"
      aria-label={`Edit ${title}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {panelStack ? (
        <div className="canvas-selection-toolbar__stack">
          <div className="canvas-selection-toolbar__stack-head">
            {titleBlock}
            {actionsBlock}
          </div>
          {widgetTextScaleSection ? (
            <div className="canvas-selection-toolbar__stack-row">{widgetTextScaleSection}</div>
          ) : null}
          {widgetSizeSection ? (
            <div className="canvas-selection-toolbar__stack-row">{widgetSizeSection}</div>
          ) : null}
          {widgetDesignSection ? (
            <div className="canvas-selection-toolbar__stack-row canvas-selection-toolbar__stack-row--scroll">
              {widgetDesignSection}
            </div>
          ) : null}
          {widgetConfigSection ? (
            <div className="canvas-selection-toolbar__stack-row">{widgetConfigSection}</div>
          ) : null}
          {moreBtn ? (
            <div className="canvas-selection-toolbar__stack-row canvas-selection-toolbar__stack-row--tools">
              {moreBtn}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="canvas-selection-toolbar__primary">
          {titleBlock}
          {isWidget ? (
            <>
              <ToolbarDivider />
              {widgetTextScaleSection}
              <ToolbarDivider />
              {widgetSizeSection}
              <ToolbarDivider />
              {widgetDesignSection}
            </>
          ) : null}
          {widgetConfigSection ? (
            <>
              <ToolbarDivider />
              {widgetConfigSection}
            </>
          ) : null}
          {moreBtn}
          {actionsBlock}
        </div>
      )}

      {detailsPanel}
    </div>
  );
}
