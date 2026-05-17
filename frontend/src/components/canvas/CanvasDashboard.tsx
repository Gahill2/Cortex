import { useCallback, useEffect, useRef, useState } from "react";
import type { Tab } from "../../App";
import type { ReactNode } from "react";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasItem } from "./CanvasItem";

export type CanvasItemType = "widget" | "image" | "text" | "note";

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
  zIndex: number;
}

interface Props {
  onNavigate: (t: Tab) => void;
  widgets: Record<string, ReactNode>;
}

const STORAGE_KEY = "cortex-canvas-state";
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

function generateId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const [maxZ, setMaxZ] = useState(() => Math.max(...(saved?.nodes ?? defaultNodes()).map((n) => n.zIndex), 0));

  const containerRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Persist state
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, pan, zoom }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [nodes, pan, zoom]);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  // Pan start (middle-click or space+click or empty area click)
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.currentTarget === e.target)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [pan]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
    if (dragId) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragId
            ? { ...n, x: dragStart.current.nodeX + dx, y: dragStart.current.nodeY + dy }
            : n
        )
      );
    }
    if (resizeId) {
      const dx = (e.clientX - resizeStart.current.x) / zoom;
      const dy = (e.clientY - resizeStart.current.y) / zoom;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === resizeId
            ? { ...n, w: Math.max(120, resizeStart.current.w + dx), h: Math.max(80, resizeStart.current.h + dy) }
            : n
        )
      );
    }
  }, [isPanning, dragId, resizeId, zoom]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    if (dragId) setDragId(null);
    if (resizeId) setResizeId(null);
  }, [isPanning, dragId, resizeId]);

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
  }, [nodes, bringToFront]);

  const startResize = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    bringToFront(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setResizeId(id);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: node.w, h: node.h };
  }, [nodes, bringToFront]);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addWidget = useCallback((widgetKey: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const centerX = (-pan.x + (containerRef.current?.clientWidth ?? 800) / 2) / zoom - 180;
    const centerY = (-pan.y + (containerRef.current?.clientHeight ?? 600) / 2) / zoom - 120;
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "widget", x: centerX, y: centerY, w: 380, h: 260, widgetKey, zIndex: newZ },
    ]);
  }, [maxZ, pan, zoom]);

  const addImage = useCallback((url: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const centerX = (-pan.x + (containerRef.current?.clientWidth ?? 800) / 2) / zoom - 150;
    const centerY = (-pan.y + (containerRef.current?.clientHeight ?? 600) / 2) / zoom - 100;
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "image", x: centerX, y: centerY, w: 320, h: 240, imageUrl: url, zIndex: newZ },
    ]);
  }, [maxZ, pan, zoom]);

  const addNote = useCallback(() => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    const centerX = (-pan.x + (containerRef.current?.clientWidth ?? 800) / 2) / zoom - 140;
    const centerY = (-pan.y + (containerRef.current?.clientHeight ?? 600) / 2) / zoom - 60;
    setNodes((prev) => [
      ...prev,
      { id: generateId(), type: "note", x: centerX, y: centerY, w: 280, h: 160, content: "", zIndex: newZ },
    ]);
  }, [maxZ, pan, zoom]);

  const updateNodeContent = useCallback((id: string, content: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15));
  const zoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

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
      />

      <div
        className={`canvas-viewport${isPanning ? " canvas-viewport--panning" : ""}${dragId ? " canvas-viewport--dragging" : ""}`}
        onWheel={onWheel}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
      >
        {/* Grid background */}
        <div
          className="canvas-grid"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            backgroundSize: `${40}px ${40}px`,
            backgroundPosition: `0 0`,
          }}
        />

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
              onDragStart={(e) => startDrag(node.id, e)}
              onResizeStart={(e) => startResize(node.id, e)}
              onRemove={() => removeNode(node.id)}
              onContentChange={(c) => updateNodeContent(node.id, c)}
            />
          ))}
        </div>
      </div>

      <div className="canvas-zoom-badge">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
