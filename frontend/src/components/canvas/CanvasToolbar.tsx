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
}

const AVAILABLE_WIDGETS = [
  { key: "weather", label: "Weather", icon: "☀️" },
  { key: "tasks", label: "Tasks", icon: "✓" },
  { key: "mail", label: "Mail", icon: "✉" },
  { key: "spotify", label: "Music", icon: "♫" },
  { key: "ai", label: "AI Chat", icon: "🤖" },
];

export function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onZoomReset, onAddWidget, onAddImage, onAddNote }: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
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
    </div>
  );
}
