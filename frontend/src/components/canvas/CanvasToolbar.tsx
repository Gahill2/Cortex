import { useRef, useState } from "react";
import { NavIcon } from "../NavIcon";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onAddWidget: (key: string) => void;
  onAddImage: (url: string) => void;
  onAddNote: () => void;
  onAddCustom: (title: string, content: string, color: string) => void;
  onAddEmbed: (url: string, title?: string) => void;
}

const AVAILABLE_WIDGETS = [
  { key: "weather", label: "Weather", icon: "☀️" },
  { key: "tasks", label: "Tasks", icon: "✓" },
  { key: "mail", label: "Mail", icon: "✉" },
  { key: "spotify", label: "Music", icon: "♫" },
  { key: "ai", label: "AI Chat", icon: "🤖" },
  { key: "pomodoro", label: "Focus Timer", icon: "⏱️" },
  { key: "clock", label: "World Clock", icon: "🕐" },
];

const COLORS = ["#5b8dff", "#3be8ad", "#f5a623", "#ff5f5f", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

export function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onZoomReset, onAddWidget, onAddImage, onAddNote, onAddCustom, onAddEmbed }: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="canvas-toolbar">
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

      <div className="canvas-toolbar__group canvas-toolbar__group--add">
        <button
          type="button"
          className="canvas-toolbar__btn canvas-toolbar__btn--primary"
          onClick={() => setShowAddMenu(!showAddMenu)}
          title="Add to canvas"
        >
          <span className="canvas-toolbar__icon">+</span>
          <span className="canvas-toolbar__label">Add</span>
        </button>

        {showAddMenu && (
          <div className="canvas-add-menu">
            <div className="canvas-add-menu__section">
              <p className="canvas-add-menu__heading">Widgets</p>
              {AVAILABLE_WIDGETS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className="canvas-add-menu__item"
                  onClick={() => { onAddWidget(w.key); setShowAddMenu(false); }}
                >
                  <span className="canvas-add-menu__icon">{w.icon}</span>
                  <span>{w.label}</span>
                </button>
              ))}
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
