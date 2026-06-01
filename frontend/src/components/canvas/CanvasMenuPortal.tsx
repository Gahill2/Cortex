import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

function useMenuPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>, menuWidth: number) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(margin, Math.min(r.right - menuWidth, window.innerWidth - menuWidth - margin));
      setPos({ top: r.bottom + margin, left });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, menuWidth]);

  return pos;
}

interface PortaledMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  menuWidth?: number;
  className?: string;
  children: ReactNode;
}

/** Renders canvas toolbar menus on document.body so overflow:hidden ancestors cannot clip them. */
export function CanvasMenuPortal({
  open,
  anchorRef,
  onClose,
  menuWidth = 240,
  className = "canvas-add-menu canvas-add-menu--portaled",
  children,
}: PortaledMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useMenuPosition(open, anchorRef, menuWidth);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      style={{ top: pos.top, left: pos.left, width: menuWidth }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

interface PortaledModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function CanvasModalPortal({ open, onClose, children }: PortaledModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="canvas-modal-overlay" onClick={onClose} role="presentation">
      {children}
    </div>,
    document.body,
  );
}
