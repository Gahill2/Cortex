import { useRef, useState } from "react";
import type { CanvasBackground } from "./canvasBackground";
import {
  CANVAS_GRADIENT_PRESETS,
  CANVAS_SOLID_PRESETS,
  DEFAULT_CANVAS_BACKGROUND,
} from "./canvasBackground";
import { WidgetStylePicker } from "./WidgetStylePicker";
import { getDefaultWidgetStyle } from "./widgetDefaultStyle";
import { CANVAS_WIDGET_TYPES, type WidgetSizeVariant } from "./widgetVariants";
import type { WidgetSkin } from "./widgetSkins";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  /** Dashboard edit mode (Home canvas) */
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenWidgetLibrary?: () => void;
  onResetLayout?: () => void;
  widgetCount?: number;
  onAddWidget: (key: string, variant: WidgetSizeVariant, skin: WidgetSkin, display: string) => void;
  onAddImage: (url: string) => void;
  onAddNote: () => void;
  onAddCustom: (title: string, content: string, color: string) => void;
  onAddEmbed: (url: string, title?: string) => void;
  onAddBackdrop: (color?: string) => void;
  background: CanvasBackground;
  onBackgroundChange: (bg: CanvasBackground) => void;
}

const COLORS = ["#5b8dff", "#3be8ad", "#f5a623", "#ff5f5f", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

export function CanvasToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  editMode = false,
  onToggleEditMode,
  onOpenWidgetLibrary,
  onResetLayout,
  widgetCount = 0,
  onAddWidget,
  onAddImage,
  onAddNote,
  onAddCustom,
  onAddEmbed,
  onAddBackdrop,
  background,
  onBackgroundChange,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [pickingWidgetKey, setPickingWidgetKey] = useState<string | null>(null);
  const [pickVariant, setPickVariant] = useState<WidgetSizeVariant>("medium");
  const [pickSkin, setPickSkin] = useState<WidgetSkin>("ios");
  const [pickDisplay, setPickDisplay] = useState("standard");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAddImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setShowAddMenu(false);
  };

  const handleImageUrl = () => {
    const url = prompt("Paste image URL:");
    if (url?.trim()) {
      onAddImage(url.trim());
    }
    setShowAddMenu(false);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onBackgroundChange({
          kind: "image",
          value: `url("${reader.result}")`,
          presetId: "custom",
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setShowBgMenu(false);
  };

  const handleBgImageUrl = () => {
    const url = prompt("Paste wallpaper image URL:");
    if (url?.trim()) {
      onBackgroundChange({
        kind: "image",
        value: url.trim().startsWith("url(") ? url.trim() : `url("${url.trim()}")`,
        presetId: "custom",
      });
    }
    setShowBgMenu(false);
  };

  const showDashboardChrome = Boolean(onToggleEditMode || onOpenWidgetLibrary);

  return (
    <div className={`canvas-toolbar${showDashboardChrome ? " canvas-toolbar--with-dashboard" : ""}`}>
      {showDashboardChrome && (
        <>
          <div className="canvas-toolbar__brand">
            <span className="canvas-toolbar__brand-title">Dashboard</span>
            <span className="canvas-toolbar__brand-meta">
              {widgetCount} widget{widgetCount === 1 ? "" : "s"}
              {editMode ? " · editing" : ""}
            </span>
          </div>
          <div className="canvas-toolbar__divider" />
        </>
      )}

      <div className="canvas-toolbar__group">
        <button type="button" className="canvas-toolbar__btn" onClick={onZoomOut} title="Zoom out">
          <span className="canvas-toolbar__icon">−</span>
        </button>
        <button type="button" className="canvas-toolbar__btn canvas-toolbar__btn--zoom" onClick={onZoomReset} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="canvas-toolbar__btn" onClick={onZoomIn} title="Zoom in">
          <span className="canvas-toolbar__icon">+</span>
        </button>
      </div>

      <div className="canvas-toolbar__divider" />

      <div className="canvas-toolbar__group canvas-toolbar__group--bg">
        <button
          type="button"
          className="canvas-toolbar__btn"
          onClick={() => { setShowBgMenu(!showBgMenu); setShowAddMenu(false); }}
          title="Canvas background"
        >
          <span className="canvas-toolbar__icon">🎨</span>
        </button>
        {showBgMenu && (
          <div className="canvas-add-menu canvas-bg-menu">
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Solid</p>
              <div className="canvas-bg-swatch-grid">
                {CANVAS_SOLID_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`canvas-bg-swatch${background.presetId === preset.id && background.kind !== "gradient" && background.kind !== "image" ? " canvas-bg-swatch--active" : ""}`}
                    style={{ background: preset.value || "var(--bg)" }}
                    title={preset.label}
                    onClick={() => {
                      if (preset.id === "default") {
                        onBackgroundChange(DEFAULT_CANVAS_BACKGROUND);
                      } else {
                        onBackgroundChange({ kind: "solid", value: preset.value, presetId: preset.id });
                      }
                      setShowBgMenu(false);
                    }}
                  >
                    {background.presetId === preset.id && background.kind !== "gradient" && background.kind !== "image" && (
                      <span className="canvas-bg-swatch-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="canvas-add-menu__divider" />
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Gradients</p>
              <div className="canvas-bg-swatch-grid">
                {CANVAS_GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`canvas-bg-swatch${background.presetId === preset.id && background.kind === "gradient" ? " canvas-bg-swatch--active" : ""}`}
                    style={{ background: preset.value }}
                    title={preset.label}
                    onClick={() => {
                      onBackgroundChange({ kind: "gradient", value: preset.value, presetId: preset.id });
                      setShowBgMenu(false);
                    }}
                  >
                    {background.presetId === preset.id && background.kind === "gradient" && (
                      <span className="canvas-bg-swatch-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="canvas-add-menu__divider" />
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Wallpaper</p>
              <button type="button" className="canvas-add-menu__item" onClick={() => bgFileRef.current?.click()}>
                <span className="canvas-add-menu__icon">📁</span>
                <span>Upload image</span>
              </button>
              <button type="button" className="canvas-add-menu__item" onClick={handleBgImageUrl}>
                <span className="canvas-add-menu__icon">🔗</span>
                <span>Image from URL</span>
              </button>
              {background.kind === "image" && (
                <button
                  type="button"
                  className="canvas-add-menu__item canvas-add-menu__item--muted"
                  onClick={() => { onBackgroundChange(DEFAULT_CANVAS_BACKGROUND); setShowBgMenu(false); }}
                >
                  <span className="canvas-add-menu__icon">✕</span>
                  <span>Remove wallpaper</span>
                </button>
              )}
            </div>
          </div>
        )}
        <input
          ref={bgFileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleBgUpload}
        />
      </div>

      <div className="canvas-toolbar__divider" />

      <div className="canvas-toolbar__group canvas-toolbar__group--add">
        <button
          type="button"
          className="canvas-toolbar__btn canvas-toolbar__btn--primary"
          onClick={() => {
            setShowAddMenu(!showAddMenu);
            setShowBgMenu(false);
            if (showAddMenu) setPickingWidgetKey(null);
          }}
          title="Add to canvas"
        >
          <span className="canvas-toolbar__icon">+</span>
          <span className="canvas-toolbar__label">Add</span>
        </button>

        {showAddMenu && (
          <div className={`canvas-add-menu${pickingWidgetKey ? " canvas-add-menu--variant" : ""}`}>
            {pickingWidgetKey ? (
              <div className="canvas-add-menu__section canvas-add-menu__section--variant">
                <button type="button" className="canvas-add-menu__back" onClick={() => setPickingWidgetKey(null)}>
                  ← Widgets
                </button>
                <p className="canvas-add-menu__heading">
                  {CANVAS_WIDGET_TYPES.find((w) => w.key === pickingWidgetKey)?.label ?? "Widget"} style
                </p>
                <WidgetStylePicker
                  variant="panel"
                  widgetKey={pickingWidgetKey}
                  size={pickVariant}
                  skin={pickSkin}
                  display={pickDisplay}
                  onSize={setPickVariant}
                  onSkin={setPickSkin}
                  onDisplay={setPickDisplay}
                />
                <button
                  type="button"
                  className="canvas-add-menu__confirm"
                  onClick={() => {
                    onAddWidget(pickingWidgetKey, pickVariant, pickSkin, pickDisplay);
                    setShowAddMenu(false);
                    setPickingWidgetKey(null);
                  }}
                >
                  Add to canvas
                </button>
              </div>
            ) : (
            <>
            {onOpenWidgetLibrary ? (
              <div className="canvas-add-menu__section canvas-add-menu__section--hint">
                <p className="canvas-add-menu__hint-text">
                  Dashboard widgets live in the library — use <strong>Widgets</strong> on the toolbar.
                </p>
              </div>
            ) : (
              <div className="canvas-add-menu__section">
                <p className="canvas-add-menu__heading">Widgets</p>
                {CANVAS_WIDGET_TYPES.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    className="canvas-add-menu__item"
                    onClick={() => {
                      const defaults = getDefaultWidgetStyle(w.key);
                      setPickingWidgetKey(w.key);
                      setPickVariant(defaults.variant);
                      setPickSkin(defaults.skin);
                      setPickDisplay(defaults.display);
                    }}
                  >
                    <span className="canvas-add-menu__icon">{w.icon}</span>
                    <span>{w.label}</span>
                    <span className="canvas-add-menu__chevron" aria-hidden>›</span>
                  </button>
                ))}
              </div>
            )}
            <div className="canvas-add-menu__divider" />
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Layout</p>
              <button
                type="button"
                className="canvas-add-menu__item"
                onClick={() => { onAddBackdrop(); setShowAddMenu(false); }}
              >
                <span className="canvas-add-menu__icon">▢</span>
                <span>Color panel</span>
              </button>
            </div>
            <div className="canvas-add-menu__divider" />
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Content</p>
              <button type="button" className="canvas-add-menu__item" onClick={() => { onAddNote(); setShowAddMenu(false); }}>
                <span className="canvas-add-menu__icon">📝</span>
                <span>Sticky Note</span>
              </button>
              <button type="button" className="canvas-add-menu__item" onClick={() => fileRef.current?.click()}>
                <span className="canvas-add-menu__icon">🖼️</span>
                <span>Upload Image</span>
              </button>
              <button type="button" className="canvas-add-menu__item" onClick={handleImageUrl}>
                <span className="canvas-add-menu__icon">🔗</span>
                <span>Image from URL</span>
              </button>
            </div>
            <div className="canvas-add-menu__divider" />
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Create</p>
              <button type="button" className="canvas-add-menu__item" onClick={() => { setShowCustomModal(true); setShowAddMenu(false); }}>
                <span className="canvas-add-menu__icon">🧩</span>
                <span>Custom Widget</span>
              </button>
              <button type="button" className="canvas-add-menu__item" onClick={() => { setShowEmbedModal(true); setShowAddMenu(false); }}>
                <span className="canvas-add-menu__icon">🌐</span>
                <span>Web Embed</span>
              </button>
            </div>
            </>
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
      </div>

      {showDashboardChrome && onToggleEditMode && (
        <>
          <div className="canvas-toolbar__divider" />
          <div className="canvas-toolbar__group canvas-toolbar__group--dashboard">
            {onOpenWidgetLibrary && (
              <button
                type="button"
                className="canvas-toolbar__btn"
                onClick={onOpenWidgetLibrary}
                title="Browse widget library"
              >
                <span className="canvas-toolbar__label">Widgets</span>
              </button>
            )}
            {editMode && onResetLayout && (
              <button
                type="button"
                className="canvas-toolbar__btn"
                onClick={onResetLayout}
                title="Restore starter layout"
              >
                <span className="canvas-toolbar__label">Reset</span>
              </button>
            )}
            <button
              type="button"
              className={`canvas-toolbar__btn canvas-toolbar__btn--edit${editMode ? " is-active" : ""}`}
              onClick={onToggleEditMode}
              title={editMode ? "Exit customize mode" : "Customize dashboard"}
            >
              <span className="canvas-toolbar__label">{editMode ? "Done" : "Customize"}</span>
            </button>
          </div>
        </>
      )}

      {showCustomModal && (
        <CustomWidgetModal
          onClose={() => setShowCustomModal(false)}
          onCreate={(title, content, color) => { onAddCustom(title, content, color); setShowCustomModal(false); }}
        />
      )}

      {showEmbedModal && (
        <EmbedModal
          onClose={() => setShowEmbedModal(false)}
          onCreate={(url, title) => { onAddEmbed(url, title); setShowEmbedModal(false); }}
        />
      )}
    </div>
  );
}

function CustomWidgetModal({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, content: string, color: string) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  return (
    <div className="canvas-modal-overlay" onClick={onClose}>
      <div className="canvas-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="canvas-modal__title">Create Custom Widget</h3>
        <div className="canvas-modal__field">
          <label>Title</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Widget" autoFocus />
        </div>
        <div className="canvas-modal__field">
          <label>Content</label>
          <textarea className="form-input canvas-modal__textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add text, links, or notes..." rows={4} />
        </div>
        <div className="canvas-modal__field">
          <label>Color</label>
          <div className="canvas-modal__colors">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`canvas-modal__color-btn${color === c ? " is-active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="canvas-modal__actions">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary btn-sm" onClick={() => onCreate(title || "Untitled", content, color)} disabled={!title.trim() && !content.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ onClose, onCreate }: { onClose: () => void; onCreate: (url: string, title?: string) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  return (
    <div className="canvas-modal-overlay" onClick={onClose}>
      <div className="canvas-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="canvas-modal__title">Embed Web Content</h3>
        <p className="canvas-modal__desc">Embed any website, video, or web app in a resizable frame.</p>
        <div className="canvas-modal__field">
          <label>URL</label>
          <input className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus />
        </div>
        <div className="canvas-modal__field">
          <label>Label (optional)</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Figma, YouTube, Docs" />
        </div>
        <div className="canvas-modal__actions">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary btn-sm" onClick={() => onCreate(url, title || undefined)} disabled={!url.trim()}>
            Embed
          </button>
        </div>
      </div>
    </div>
  );
}
