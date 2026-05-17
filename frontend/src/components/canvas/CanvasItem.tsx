import type { ReactNode } from "react";
import { useState } from "react";
import type { CanvasNode } from "./CanvasDashboard";

interface Props {
  node: CanvasNode;
  widgets: Record<string, ReactNode>;
  isSelected?: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onRemove: () => void;
  onContentChange: (content: string) => void;
}

export function CanvasItem({ node, widgets, isSelected, onDragStart, onResizeStart, onRemove, onContentChange }: Props) {
  const [hovered, setHovered] = useState(false);

  const renderContent = () => {
    switch (node.type) {
      case "widget":
        return (
          <div className="canvas-item__widget">
            {node.widgetKey && widgets[node.widgetKey] ? widgets[node.widgetKey] : (
              <div className="canvas-item__placeholder">Widget: {node.widgetKey}</div>
            )}
          </div>
        );
      case "image":
        return (
          <div className="canvas-item__image-wrap">
            <img
              src={node.imageUrl}
              alt=""
              className="canvas-item__image"
              draggable={false}
            />
          </div>
        );
      case "text":
        return (
          <div className="canvas-item__text">
            <p>{node.content}</p>
          </div>
        );
      case "note":
        return (
          <div className="canvas-item__note">
            <textarea
              className="canvas-item__note-input"
              value={node.content ?? ""}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Type your note..."
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`canvas-item canvas-item--${node.type}${hovered ? " canvas-item--hovered" : ""}${isSelected ? " canvas-item--selected" : ""}`}
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
      {/* Drag handle (title bar) */}
      <div className="canvas-item__header" onPointerDown={onDragStart}>
        <span className="canvas-item__drag-dots" aria-hidden>⋮⋮</span>
        <span className="canvas-item__type-label">
          {node.type === "widget" ? node.widgetKey : node.type}
        </span>
        <button
          type="button"
          className="canvas-item__close"
          onClick={onRemove}
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="canvas-item__body">
        {renderContent()}
      </div>

      {/* Resize handle */}
      <div className="canvas-item__resize" onPointerDown={onResizeStart}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="6" cy="10" r="1.5" />
          <circle cx="10" cy="6" r="1.5" />
        </svg>
      </div>

      {/* Picture frame decorative border */}
      <div className="canvas-item__frame" />
    </div>
  );
}
