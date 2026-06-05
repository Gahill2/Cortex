import { useEffect, useRef, useState } from "react";
import type { CanvasNode } from "./CanvasDashboard";

export interface TextContent {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  textDecoration: string;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  background: string;
  padding: number;
}

export const defaultTextContent: TextContent = {
  text: "",
  fontFamily: "Inter, sans-serif",
  fontSize: 16,
  fontWeight: 400,
  fontStyle: "normal",
  textDecoration: "none",
  color: "var(--color-text, #e2e8f0)",
  align: "left",
  lineHeight: 1.5,
  letterSpacing: 0,
  background: "transparent",
  padding: 8,
};

interface Props {
  node: CanvasNode;
  editMode?: boolean;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onStopEditing?: () => void;
  onTextChange: (text: string) => void;
  onHeightChange?: (h: number) => void;
}

export function TextCanvasNode({
  node,
  editMode = false,
  isEditing = false,
  onStartEditing,
  onStopEditing,
  onTextChange,
  onHeightChange,
}: Props) {
  const tc: TextContent = { ...defaultTextContent, ...(node.textContent ?? {}) };
  const divRef = useRef<HTMLDivElement>(null);
  const [localEditing, setLocalEditing] = useState(false);
  const editing = isEditing || localEditing;

  // Sync content into div when not editing
  useEffect(() => {
    const el = divRef.current;
    if (!el || editing) return;
    if (el.innerText !== tc.text) {
      el.innerText = tc.text ?? "";
    }
  }, [tc.text, editing]);

  // ResizeObserver to auto-report height
  useEffect(() => {
    const el = divRef.current;
    if (!el || !onHeightChange) return;
    const ro = new ResizeObserver(() => {
      onHeightChange(Math.max(40, el.scrollHeight + tc.padding * 2 + 4));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, tc.padding]);

  const enterEdit = () => {
    if (!editMode) return;
    setLocalEditing(true);
    onStartEditing?.();
    requestAnimationFrame(() => {
      const el = divRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  };

  const exitEdit = () => {
    setLocalEditing(false);
    onStopEditing?.();
    const el = divRef.current;
    if (el) onTextChange(el.innerText ?? "");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      exitEdit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("bold");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("italic");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "u") {
      e.preventDefault();
      document.execCommand("underline");
    }
  };

  const isEmpty = !tc.text || tc.text.trim() === "";

  return (
    <div
      className={`text-canvas-node${editing ? " text-canvas-node--editing" : ""}${isEmpty && !editing ? " text-canvas-node--empty" : ""}`}
      style={{
        background: tc.background,
        padding: tc.padding,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        cursor: editMode && !editing ? "text" : undefined,
      }}
      onDoubleClick={enterEdit}
    >
      {isEmpty && !editing && (
        <span
          className="text-canvas-node__placeholder"
          aria-hidden
          style={{
            position: "absolute",
            inset: tc.padding,
            color: "var(--color-text-muted, #64748b)",
            fontFamily: tc.fontFamily,
            fontSize: tc.fontSize,
            lineHeight: tc.lineHeight,
            pointerEvents: "none",
          }}
        >
          Double-click to edit
        </span>
      )}
      <div
        ref={divRef}
        className="text-canvas-node__content"
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={exitEdit}
        onKeyDown={onKeyDown}
        style={{
          fontFamily: tc.fontFamily,
          fontSize: tc.fontSize,
          fontWeight: tc.fontWeight,
          fontStyle: tc.fontStyle,
          textDecoration: tc.textDecoration,
          color: tc.color,
          textAlign: tc.align,
          lineHeight: tc.lineHeight,
          letterSpacing: `${tc.letterSpacing}px`,
          outline: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minHeight: "1em",
          opacity: isEmpty && !editing ? 0 : 1,
        }}
        onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
      />
    </div>
  );
}
