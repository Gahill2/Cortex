import { useCallback, useEffect, useRef, useState } from "react";
import type { Tab } from "../../App";
import type { ReactNode } from "react";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasItem } from "./CanvasItem";
import { CanvasMinimap } from "./CanvasMinimap";

export type CanvasItemType = "widget" | "image" | "text" | "note" | "custom" | "embed";

export interface CanvasNode {
  id: string;
  type: CanvasItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  widgetKey?: string;
  imageUrl?: string;
  title?: string;
  color?: string;
  embedUrl?: string;
  zIndex: number;
}

interface Props {
  onNavigate: (t: Tab) => void;
  widgets: Record<string, ReactNode>;
}

const STORAGE_KEY = "cortex-canvas-state";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.0015;
const GRID_SIZE = 24;

function generateId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function loadState(): { nodes: CanvasNode[]; pan: { x: number; y: number }; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function defaultNodes(): CanvasNode[] {
  return [
    { id: generateId(), type: "widget", x: 60, y: 60, w: 380, h: 260, widgetKey: "weather", zIndex: 1 },
    { id: generateId(), type: "widget", x: 480, y: 60, w: 420, h: 320, widgetKey: "tasks", zIndex: 2 },
    { id: generateId(), type: "widget", x: 60, y: 360, w: 380, h: 280, widgetKey: "spotify", zIndex: 3 },
    { id: generateId(), type: "widget", x: 480, y: 420, w: 420, h: 280, widgetKey: "mail", zIndex: 4 },
    { id: generateId(), type: "widget", x: 940, y: 60, w: 360, h: 300, widgetKey: "ai", zIndex: 5 },
    { id: generateId(), type: "text", x: 940, y: 400, w: 320, h: 100, content: "Welcome to your Canvas Dashboard — drag, zoom, and add anything!", zIndex: 6 },
  ];
}

export function CanvasDashboard({ onNavigate, widgets }: Props) {
  const saved = loadState();
  const [nodes, setNodes] = useState<CanvasNode[]>(saved?.nodes ?? defaultNodes);
  const [pan, setPan] = useState(saved?.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(saved?.zoom ?? 1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selBox, setSelBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [maxZ, setMaxZ] = useState(() => Math.max(...(saved?.nodes ?? defaultNodes()).map((n) => n.zIndex), 0));

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const selStart = useRef({ x: 0, y: 0 });
  const zoomAnimRef = useRef<number>(0);
  const dragElRef = useRef<HTMLElement | null>(null);
  const resizeElRef = useRef<HTMLElement | null>(null);

  // Persist state (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, pan, zoom }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [nodes, pan, zoom]);

  // Prevent browser zoom on Ctrl+scroll at the DOM level
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Zoom toward cursor (Figma-style) ─────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom toward the pointer position
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = clampZoom(zoom * factor);
      const ratio = newZoom / zoom;

      // Adjust pan so the point under cursor stays fixed
      const newPanX = cx - ratio * (cx - pan.x);
      const newPanY = cy - ratio * (cy - pan.y);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // Scroll to pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [zoom, pan]);

  // ── Pan ───────────────────────────────────────────────────────────────────
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const isCanvas = e.currentTarget === e.target;
    if (e.button === 1 || (e.button === 0 && isCanvas && !e.shiftKey)) {
      // Pan
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (e.button === 0 && isCanvas && e.shiftKey) {
      // Box selection
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - pan.x) / zoom;
      const wy = (e.clientY - rect.top - pan.y) / zoom;
      selStart.current = { x: wx, y: wy };
      setSelBox({ x1: wx, y1: wy, x2: wx, y2: wy });
      if (!e.ctrlKey && !e.metaKey) setSelected(new Set());
    }
  }, [pan, zoom]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
    if (dragId && dragElRef.current) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      const newX = dragStart.current.nodeX + dx;
      const newY = dragStart.current.nodeY + dy;
      dragElRef.current.style.left = `${newX}px`;
      dragElRef.current.style.top = `${newY}px`;
    }
    if (resizeId && resizeElRef.current) {
      const dx = (e.clientX - resizeStart.current.x) / zoom;
      const dy = (e.clientY - resizeStart.current.y) / zoom;
      const newW = Math.max(120, resizeStart.current.w + dx);
      const newH = Math.max(80, resizeStart.current.h + dy);
      resizeElRef.current.style.width = `${newW}px`;
      resizeElRef.current.style.height = `${newH}px`;
    }
    if (selBox) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - pan.x) / zoom;
      const wy = (e.clientY - rect.top - pan.y) / zoom;
      setSelBox({ x1: selStart.current.x, y1: selStart.current.y, x2: wx, y2: wy });
    }
  }, [isPanning, dragId, resizeId, zoom, selBox, pan]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (dragId && dragElRef.current) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      const finalX = dragStart.current.nodeX + dx;
      const finalY = dragStart.current.nodeY + dy;
      dragElRef.current.style.willChange = "";
      dragElRef.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === dragId ? { ...n, x: finalX, y: finalY } : n))
      );
      setDragId(null);
    } else if (dragId) {
      setDragId(null);
    }
    if (resizeId && resizeElRef.current) {
      const dx = (e.clientX - resizeStart.current.x) / zoom;
      const dy = (e.clientY - resizeStart.current.y) / zoom;
      const finalW = Math.max(120, resizeStart.current.w + dx);
      const finalH = Math.max(80, resizeStart.current.h + dy);
      resizeElRef.current.style.willChange = "";
      resizeElRef.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === resizeId ? { ...n, w: finalW, h: finalH } : n))
      );
      setResizeId(null);
    } else if (resizeId) {
      setResizeId(null);
    }
    if (selBox) {
      const bx1 = Math.min(selBox.x1, selBox.x2);
      const by1 = Math.min(selBox.y1, selBox.y2);
      const bx2 = Math.max(selBox.x1, selBox.x2);
      const by2 = Math.max(selBox.y1, selBox.y2);
      const hits = nodes
        .filter((n) => n.x + n.w > bx1 && n.x < bx2 && n.y + n.h > by1 && n.y < by2)
        .map((n) => n.id);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of hits) next.add(id);
        return next;
      });
      setSelBox(null);
    }
  }, [isPanning, dragId, resizeId, selBox, nodes, zoom]);

  const bringToFront = useCallback((id: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, zIndex: newZ } : n)));
  }, [maxZ]);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    bringToFront(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setDragId(id);
    dragStart.current = { x: e.clientX, y: e.clientY, nodeX: node.x, nodeY: node.y };
    // Capture the DOM element for direct manipulation (no React re-renders during drag)
    const header = e.currentTarget as HTMLElement;
    dragElRef.current = header.closest(".canvas-item") as HTMLElement | null;
    if (dragElRef.current) dragElRef.current.style.willChange = "left, top";
    if (!e.shiftKey) setSelected(new Set([id]));
    else setSelected((prev) => { const next = new Set(prev); next.add(id); return next; });
  }, [nodes, bringToFront]);

  const startResize = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    bringToFront(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setResizeId(id);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: node.w, h: node.h };
    const handle = e.currentTarget as HTMLElement;
    resizeElRef.current = handle.closest(".canvas-item") as HTMLElement | null;
    if (resizeElRef.current) resizeElRef.current.style.willChange = "width, height";
  }, [nodes, bringToFront]);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const viewCenter = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 800;
    const ch = containerRef.current?.clientHeight ?? 600;
    return { x: (-pan.x + cw / 2) / zoom, y: (-pan.y + ch / 2) / zoom };
  }, [pan, zoom]);

  const addWidget = useCallback((widgetKey: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const c = viewCenter();
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "widget", x: c.x - 190, y: c.y - 130, w: 380, h: 260, widgetKey, zIndex: newZ },
    ]);
  }, [maxZ, viewCenter]);

  const addImage = useCallback((url: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const c = viewCenter();
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "image", x: c.x - 160, y: c.y - 120, w: 320, h: 240, imageUrl: url, zIndex: newZ },
    ]);
  }, [maxZ, viewCenter]);

  const addNote = useCallback(() => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const c = viewCenter();
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "note", x: c.x - 140, y: c.y - 80, w: 280, h: 160, content: "", zIndex: newZ },
    ]);
  }, [maxZ, viewCenter]);

  const addCustom = useCallback((title: string, content: string, color: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const c = viewCenter();
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "custom", x: c.x - 160, y: c.y - 100, w: 320, h: 200, title, content, color, zIndex: newZ },
    ]);
  }, [maxZ, viewCenter]);

  const addEmbed = useCallback((embedUrl: string, title?: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const c = viewCenter();
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "embed", x: c.x - 200, y: c.y - 150, w: 400, h: 300, embedUrl, title: title ?? embedUrl, zIndex: newZ },
    ]);
  }, [maxZ, viewCenter]);

  const updateNodeContent = useCallback((id: string, content: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
  }, []);

  const updateNodeTitle = useCallback((id: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
  }, []);

  // Animated zoom for toolbar buttons
  const animateZoom = useCallback((targetZoom: number) => {
    cancelAnimationFrame(zoomAnimRef.current);
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) { setZoom(clampZoom(targetZoom)); return; }

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const startZoom = zoom;
    const startPan = { ...pan };
    const start = performance.now();
    const duration = 150;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const z = startZoom + (targetZoom - startZoom) * ease;
      const ratio = z / startZoom;
      const px = cx - ratio * (cx - startPan.x);
      const py = cy - ratio * (cy - startPan.y);
      setZoom(z);
      setPan({ x: px, y: py });
      if (t < 1) zoomAnimRef.current = requestAnimationFrame(step);
    };
    zoomAnimRef.current = requestAnimationFrame(step);
  }, [zoom, pan]);

  const zoomIn = () => animateZoom(clampZoom(zoom * 1.25));
  const zoomOut = () => animateZoom(clampZoom(zoom / 1.25));
  const zoomReset = () => { animateZoom(1); setTimeout(() => setPan({ x: 0, y: 0 }), 160); };

  // Delete selected with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        setNodes((prev) => prev.filter((n) => !selected.has(n.id)));
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Grid CSS variables
  const gridSize = GRID_SIZE * zoom;
  const gridOffX = pan.x % gridSize;
  const gridOffY = pan.y % gridSize;

  // Selection box in screen coords
  const selRect = selBox ? {
    left: Math.min(selBox.x1, selBox.x2) * zoom + pan.x,
    top: Math.min(selBox.y1, selBox.y2) * zoom + pan.y,
    width: Math.abs(selBox.x2 - selBox.x1) * zoom,
    height: Math.abs(selBox.y2 - selBox.y1) * zoom,
  } : null;

  return (
    <div className="canvas-dashboard" ref={containerRef}>
      <CanvasToolbar
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onAddWidget={addWidget}
        onAddImage={addImage}
        onAddNote={addNote}
        onAddCustom={addCustom}
        onAddEmbed={addEmbed}
      />

      <div
        ref={viewportRef}
        className={`canvas-viewport${isPanning ? " canvas-viewport--panning" : ""}${dragId ? " canvas-viewport--dragging" : ""}${selBox ? " canvas-viewport--selecting" : ""}`}
        onWheel={onWheel}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        style={{
          "--grid-size": `${gridSize}px`,
          "--grid-off-x": `${gridOffX}px`,
          "--grid-off-y": `${gridOffY}px`,
          "--grid-opacity": `${Math.min(0.5, Math.max(0.15, zoom * 0.25))}`,
        } as React.CSSProperties}
      >
        {/* Canvas content layer */}
        <div
          className="canvas-layer"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {nodes.map((node) => (
            <CanvasItem
              key={node.id}
              node={node}
              widgets={widgets}
              isSelected={selected.has(node.id)}
              onDragStart={(e) => startDrag(node.id, e)}
              onResizeStart={(e) => startResize(node.id, e)}
              onRemove={() => removeNode(node.id)}
              onContentChange={(c) => updateNodeContent(node.id, c)}
              onTitleChange={(t) => updateNodeTitle(node.id, t)}
            />
          ))}
        </div>

        {/* Selection box */}
        {selRect && (
          <div className="canvas-sel-box" style={selRect} />
        )}
      </div>

      <CanvasMinimap
        nodes={nodes}
        pan={pan}
        zoom={zoom}
        viewportWidth={containerRef.current?.clientWidth ?? 800}
        viewportHeight={containerRef.current?.clientHeight ?? 600}
      />

      <div className="canvas-zoom-badge">
        {Math.round(zoom * 100)}%
      </div>

      <div className="canvas-hints">
        Scroll to pan · Ctrl+scroll to zoom · Shift+drag to select · Delete to remove
      </div>
    </div>
  );
}
