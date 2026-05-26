import { useEffect, useRef, useState } from "react";
import {
  Grid3x3,
  Magnet,
  Maximize2,
  Minus,
  Plus,
  ChevronDown,
} from "lucide-react";
import type { CanvasViewPrefs, GridStyle } from "./canvasViewPrefs";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (value: number) => void;
  onFit: () => void;
  prefs: CanvasViewPrefs;
  onPrefsChange: (patch: Partial<CanvasViewPrefs>) => void;
}

export function CanvasViewControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onFit,
  prefs,
  onPrefsChange,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const pct = Math.round(zoom * 100);

  return (
    <div className="canvas-view-controls" ref={rootRef}>
      <div className="canvas-view-controls__cluster">
        <button
          type="button"
          className={`canvas-view-controls__btn${prefs.showGrid ? " is-active" : ""}`}
          title={prefs.showGrid ? "Hide grid" : "Show grid"}
          aria-pressed={prefs.showGrid}
          onClick={() => onPrefsChange({ showGrid: !prefs.showGrid })}
        >
          <Grid3x3 size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`canvas-view-controls__btn${prefs.snapToGrid ? " is-active" : ""}`}
          title={prefs.snapToGrid ? "Free placement (snap off)" : "Snap to grid"}
          aria-pressed={prefs.snapToGrid}
          onClick={() => onPrefsChange({ snapToGrid: !prefs.snapToGrid })}
        >
          <Magnet size={16} strokeWidth={2} />
        </button>
        <span className="canvas-view-controls__sep" aria-hidden />
        <button
          type="button"
          className="canvas-view-controls__btn"
          title="Zoom out"
          onClick={onZoomOut}
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="canvas-view-controls__btn canvas-view-controls__btn--zoom"
          title="Zoom level"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {pct}%
          <ChevronDown size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="canvas-view-controls__btn"
          title="Zoom in"
          onClick={onZoomIn}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
        <button type="button" className="canvas-view-controls__btn" title="Fit board" onClick={onFit}>
          <Maximize2 size={16} strokeWidth={2} />
        </button>
      </div>

      {menuOpen ? (
        <div className="canvas-view-controls__menu" role="menu">
          <p className="canvas-view-controls__menu-label">Zoom</p>
          <div className="canvas-view-controls__presets">
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                type="button"
                role="menuitem"
                className={`canvas-view-controls__preset${Math.abs(zoom - z) < 0.02 ? " is-active" : ""}`}
                onClick={() => {
                  onZoomTo(z);
                  setMenuOpen(false);
                }}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
          <div className="canvas-view-controls__menu-divider" />
          <p className="canvas-view-controls__menu-label">Grid</p>
          <div className="canvas-view-controls__row">
            <span>Style</span>
            <div className="canvas-view-controls__seg">
              {(["dots", "lines"] as GridStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  className={prefs.gridStyle === style ? "is-active" : ""}
                  onClick={() => onPrefsChange({ gridStyle: style })}
                >
                  {style === "dots" ? "Dots" : "Lines"}
                </button>
              ))}
            </div>
          </div>
          <div className="canvas-view-controls__row">
            <span>Size</span>
            <div className="canvas-view-controls__seg">
              {([8, 16, 24] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className={prefs.gridSize === size ? "is-active" : ""}
                  onClick={() => onPrefsChange({ gridSize: size })}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="canvas-view-controls__menu-action"
            onClick={() => {
              onFit();
              setMenuOpen(false);
            }}
          >
            Fit all widgets
          </button>
        </div>
      ) : null}
    </div>
  );
}
