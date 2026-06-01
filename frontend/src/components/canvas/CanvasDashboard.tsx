import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Tab } from "../../App";
import type { ReactNode } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { CanvasLayoutPref } from "../../lib/preferencesTypes";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasSelectionToolbar } from "./CanvasSelectionToolbar";
import { CanvasItem } from "./CanvasItem";
import { CanvasMinimap } from "./CanvasMinimap";
import {
  type CanvasBackground,
  canvasBackgroundCss,
  loadCanvasBackground,
  saveCanvasBackground,
} from "./canvasBackground";
import {
  getVariantPreset,
  normalizeWidgetVariant,
  type WidgetSizeVariant,
} from "./widgetVariants";
import { buildWidgetRenderStyle, type WidgetRenderStyle } from "./widgetRenderStyle";
import type { WidgetSkin } from "./widgetSkins";
import { prepareCanvasPointerGesture } from "./canvasPointer";
import { clearNativeSelection } from "./canvasSelection";
import { DEFAULT_BACKDROP_COLOR } from "./backdropColors";
import {
  loadCanvasFromLocalStorage,
  mergeCanvasImageUrlsFromLocal,
  migrateCanvasDataUrlImages,
} from "../../lib/canvasState";
import { createDefaultDashboardNodes } from "../../dashboard/defaultLayout";
import {
  clearProductivityLayoutAfterMigration,
  tryMigrateProductivityLayoutToCanvas,
} from "../../lib/migrateProductivityLayoutToCanvas";
import { WidgetLibrary } from "../../dashboard/WidgetLibrary";
import { DashboardEmptyState } from "../../dashboard/DashboardEmptyState";
import type { WidgetRegistryEntry } from "../../dashboard/types";
import { useCanvasViewPrefs } from "./canvasViewPrefs";
import { computeFitView } from "./canvasFit";
import { CanvasViewControls } from "./CanvasViewControls";
import { HomeGlanceBar } from "../home/HomeGlanceBar";
import { DashboardCustomizeStrip } from "./DashboardCustomizeStrip";
import { useUiCustomization } from "../../hooks/useUiCustomization";

export type CanvasItemType = "widget" | "image" | "text" | "note" | "custom" | "embed" | "backdrop";

export interface CanvasNode {
  id: string;
  type: CanvasItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  widgetKey?: string;
  /** small | medium | large — iOS-style canvas widget size */
  widgetVariant?: WidgetSizeVariant;
  /** notion | canva | ios | cortex */
  widgetSkin?: WidgetSkin;
  /** Per-widget layout aesthetic (clock analog, weather hero, etc.) */
  widgetDisplay?: string;
  imageUrl?: string;
  title?: string;
  color?: string;
  embedUrl?: string;
  /** Filled rectangle behind widgets — fill color */
  backdropColor?: string;
  /** 0–1 fill opacity (default 0.45) */
  backdropOpacity?: number;
  backdropRadius?: number;
  backdropBorderWidth?: number;
  backdropBorderColor?: string;
  /** 0–1 layer opacity for non-backdrop items (default 1) */
  opacity?: number;
  /** Corner radius in px for widgets, images, notes, etc. */
  cornerRadius?: number;
  /** Rotation in degrees (-180…180) */
  rotation?: number;
  /** Per-widget settings (title override, accent, compact flag) — sync-ready via prefs later */
  widgetConfig?: Record<string, unknown>;
  zIndex: number;
}

interface Props {
  onNavigate: (t: Tab) => void;
  /** Legacy static widgets (used if renderWidget is omitted). */
  widgets?: Record<string, ReactNode>;
  /** Preferred: render widget by key + size variant. */
  renderWidget?: (
    widgetKey: string,
    style: WidgetRenderStyle,
    instance?: { title?: string; widgetConfig?: Record<string, unknown> },
  ) => ReactNode;
  /** When set, customize mode is controlled by the parent. */
  editMode?: boolean;
  onEditModeChange?: (next: boolean) => void;
  /** Controlled widget library (e.g. home workbench “Add widget”). */
  libraryOpen?: boolean;
  onLibraryOpenChange?: (open: boolean) => void;
  /** Command palette shortcut (home toolbar). */
  onCommand?: () => void;
}

const STORAGE_KEY = "cortex-canvas-state";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.0015;
const SNAP_THRESHOLD = 8;
const GUIDE_THRESHOLD = 6;

function generateId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function normalizeBackdrop(node: CanvasNode): CanvasNode {
  if (node.type !== "backdrop") return node;
  return {
    ...node,
    backdropColor: node.backdropColor ?? node.color ?? DEFAULT_BACKDROP_COLOR,
    backdropOpacity: node.backdropOpacity ?? 0.45,
    backdropRadius: node.backdropRadius ?? 16,
    backdropBorderWidth: node.backdropBorderWidth ?? 0,
    backdropBorderColor: node.backdropBorderColor ?? "rgba(255,255,255,0.18)",
    w: node.w || 400,
    h: node.h || 280,
  };
}

function normalizeNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map((n) => {
    if (n.type === "backdrop") return normalizeBackdrop(n);
    if (n.type !== "widget" || !n.widgetKey) return n;
    const style = buildWidgetRenderStyle(n.widgetKey, n.widgetVariant, n.widgetSkin, n.widgetDisplay);
    const preset = getVariantPreset(n.widgetKey, style.variant);
    return {
      ...n,
      widgetVariant: style.variant,
      widgetSkin: style.skin,
      widgetDisplay: style.display,
      w: n.w || preset.w,
      h: n.h || preset.h,
    };
  });
}

function nextBackdropZIndex(nodes: CanvasNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.min(...nodes.map((n) => n.zIndex)) - 1;
}

function loadState(): { nodes: CanvasNode[]; pan: { x: number; y: number }; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { nodes: CanvasNode[]; pan: { x: number; y: number }; zoom: number };
      if (parsed.nodes) parsed.nodes = normalizeNodes(parsed.nodes);
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function initialCanvasNodes(): CanvasNode[] {
  const migrated = tryMigrateProductivityLayoutToCanvas();
  if (migrated?.length) {
    clearProductivityLayoutAfterMigration();
    return migrated;
  }
  return createDefaultDashboardNodes();
}

export function CanvasDashboard({
  onNavigate,
  widgets = {},
  renderWidget,
  editMode: editModeProp,
  onEditModeChange,
  libraryOpen: libraryOpenProp,
  onLibraryOpenChange,
  onCommand,
}: Props) {
  const { settings, ready, patch } = usePreferences();
  const { ui } = useUiCustomization();
  const { prefs: viewPrefs, patch: patchViewPrefs } = useCanvasViewPrefs();
  const viewPrefsRef = useRef(viewPrefs);
  viewPrefsRef.current = viewPrefs;
  const canvasHydratedRef = useRef(false);
  const appliedLayoutRef = useRef<string>("");
  const saved = loadState();
  const [nodes, setNodes] = useState<CanvasNode[]>(() =>
    normalizeNodes(saved?.nodes ?? initialCanvasNodes()),
  );
  const [pan, setPan] = useState(saved?.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(saved?.zoom ?? 1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pendingDragId, setPendingDragId] = useState<string | null>(null);
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selBox, setSelBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [guides, setGuides] = useState<{ type: "h" | "v"; pos: number }[]>([]);
  const [editModeLocal, setEditModeLocal] = useState(false);
  const editModeControlled = onEditModeChange !== undefined;
  const editMode = editModeControlled ? Boolean(editModeProp) : editModeLocal;
  const setEditMode = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(editMode) : next;
    if (editModeControlled) onEditModeChange(value);
    else setEditModeLocal(value);
  };
  const [libraryOpenLocal, setLibraryOpenLocal] = useState(false);
  const libraryControlled = onLibraryOpenChange !== undefined;
  const libraryOpen = libraryControlled ? Boolean(libraryOpenProp) : libraryOpenLocal;
  const setLibraryOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(libraryOpen) : next;
    if (libraryControlled) onLibraryOpenChange(value);
    else setLibraryOpenLocal(value);
  };
  const [maxZ, setMaxZ] = useState(() =>
    Math.max(...(saved?.nodes ?? initialCanvasNodes()).map((n) => n.zIndex), 0),
  );
  const [background, setBackground] = useState<CanvasBackground>(loadCanvasBackground);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const chromeSyncRafRef = useRef(0);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const selStart = useRef({ x: 0, y: 0 });
  const zoomAnimRef = useRef<number>(0);
  const dragElRef = useRef<HTMLElement | null>(null);
  const dragMovedRef = useRef(false);
  const pendingDragRef = useRef<{
    id: string;
    pointerId: number;
    x: number;
    y: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const dragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragRafRef = useRef(0);
  const DRAG_ACTIVATE_PX = 5;
  const resizeElRef = useRef<HTMLElement | null>(null);
  const guidesRef = useRef<{ type: "h" | "v"; pos: number }[]>([]);

  const applyViewportGrid = useCallback((p: { x: number; y: number }, z: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vp = viewPrefsRef.current;
    const base = vp.gridSize;
    const gridSize = base * z;
    viewport.style.setProperty("--grid-size", `${gridSize}px`);
    viewport.style.setProperty("--grid-off-x", `${p.x % gridSize}px`);
    viewport.style.setProperty("--grid-off-y", `${p.y % gridSize}px`);
    viewport.style.setProperty(
      "--grid-opacity",
      vp.showGrid ? `${Math.min(0.55, Math.max(0.12, z * 0.22))}` : "0",
    );
  }, []);

  const applyLayerTransform = useCallback((p: { x: number; y: number }, z: number) => {
    panRef.current = p;
    zoomRef.current = z;
    const layer = layerRef.current;
    if (layer) {
      layer.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${z})`;
    }
    applyViewportGrid(p, z);
  }, [applyViewportGrid]);

  const scheduleChromeSync = useCallback(() => {
    if (chromeSyncRafRef.current) return;
    chromeSyncRafRef.current = requestAnimationFrame(() => {
      chromeSyncRafRef.current = 0;
      setPan({ ...panRef.current });
      setZoom(zoomRef.current);
    });
  }, []);

  const commitChromeSync = useCallback(() => {
    if (chromeSyncRafRef.current) {
      cancelAnimationFrame(chromeSyncRafRef.current);
      chromeSyncRafRef.current = 0;
    }
    setPan({ ...panRef.current });
    setZoom(zoomRef.current);
  }, []);

  useLayoutEffect(() => {
    applyLayerTransform(pan, zoom);
  }, [pan, zoom, applyLayerTransform]);

  useLayoutEffect(() => {
    applyViewportGrid(panRef.current, zoomRef.current);
  }, [viewPrefs, applyViewportGrid]);

  useEffect(() => {
    return () => {
      if (chromeSyncRafRef.current) cancelAnimationFrame(chromeSyncRafRef.current);
      if (zoomAnimRef.current) cancelAnimationFrame(zoomAnimRef.current);
    };
  }, []);

  // Hydrate from server when preferences load or another device saves layout
  useEffect(() => {
    if (!ready) return;
    const layout = settings.canvasLayout as CanvasLayoutPref | null;
    const fp = JSON.stringify(layout ?? null);
    if (fp === appliedLayoutRef.current) return;
    appliedLayoutRef.current = fp;

    void (async () => {
      const local = loadCanvasFromLocalStorage();
      let nextNodes = layout?.nodes?.length
        ? normalizeNodes(layout.nodes)
        : local?.nodes?.length
          ? normalizeNodes(local.nodes)
          : normalizeNodes(saved?.nodes ?? createDefaultDashboardNodes());

      nextNodes = mergeCanvasImageUrlsFromLocal(nextNodes, local?.nodes);
      try {
        nextNodes = await migrateCanvasDataUrlImages(nextNodes, true);
      } catch (err) {
        console.warn("[canvas] image upload migration failed:", err);
      }

      setNodes(nextNodes);
      setPan(layout?.pan ?? local?.pan ?? saved?.pan ?? { x: 0, y: 0 });
      setZoom(clampZoom(layout?.zoom ?? local?.zoom ?? saved?.zoom ?? 1));
      setMaxZ(Math.max(...nextNodes.map((n) => n.zIndex), 0));
      if (layout?.background) setBackground(layout.background);
      else if (local) {
        const bg = loadCanvasBackground();
        if (bg.kind !== "default") setBackground(bg);
      }
      canvasHydratedRef.current = true;
    })();
  }, [ready, settings.canvasLayout]);

  // Persist canvas + widgets to account settings (debounced)
  useEffect(() => {
    if (!ready || !canvasHydratedRef.current) return;
    const timeout = setTimeout(() => {
      const payload: CanvasLayoutPref = {
        nodes,
        pan,
        zoom,
        background: background.kind !== "default" ? background : undefined,
      };
      patch({ canvasLayout: payload });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, pan, zoom }));
        saveCanvasBackground(background);
      } catch {
        /* ignore quota */
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [nodes, pan, zoom, background, ready, patch]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const blockSelectStart = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    vp.addEventListener("selectstart", blockSelectStart);
    return () => vp.removeEventListener("selectstart", blockSelectStart);
  }, []);

  const onBackgroundChange = useCallback((bg: CanvasBackground) => {
    setBackground(bg);
  }, []);

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

  // ── Zoom toward cursor (Figma-style: pinch/Ctrl+scroll; Alt+scroll on trackpads) ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    const curZoom = zoomRef.current;
    const curPan = panRef.current;
    if (e.ctrlKey || e.metaKey || e.altKey) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = clampZoom(curZoom * factor);
      const ratio = newZoom / curZoom;
      const newPan = {
        x: cx - ratio * (cx - curPan.x),
        y: cy - ratio * (cy - curPan.y),
      };

      applyLayerTransform(newPan, newZoom);
      scheduleChromeSync();
    } else {
      applyLayerTransform(
        { x: curPan.x - e.deltaX, y: curPan.y - e.deltaY },
        curZoom,
      );
      scheduleChromeSync();
    }
  }, [applyLayerTransform, scheduleChromeSync]);

  // ── Pan ───────────────────────────────────────────────────────────────────
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const isCanvas = e.currentTarget === e.target;
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    if (e.button === 1 || (e.button === 0 && isCanvas && !e.shiftKey)) {
      prepareCanvasPointerGesture(e);
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: curPan.x, panY: curPan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (e.button === 0 && isCanvas && e.shiftKey) {
      prepareCanvasPointerGesture(e);
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - curPan.x) / curZoom;
      const wy = (e.clientY - rect.top - curPan.y) / curZoom;
      selStart.current = { x: wx, y: wy };
      setSelBox({ x1: wx, y1: wy, x2: wx, y2: wy });
      if (!e.ctrlKey && !e.metaKey) setSelected(new Set());
    }
  }, []);

  const setGuidesIfChanged = useCallback((next: { type: "h" | "v"; pos: number }[]) => {
    const prev = guidesRef.current;
    if (
      prev.length === next.length &&
      prev.every((g, i) => g.type === next[i]?.type && g.pos === next[i]?.pos)
    ) {
      return;
    }
    guidesRef.current = next;
    setGuides(next);
  }, []);

  const applyDragTransform = useCallback((clientX: number, clientY: number) => {
    const el = dragElRef.current;
    const id = dragId;
    if (!el || !id) return;
    const curZoom = zoomRef.current;
    const px = clientX - dragStart.current.x;
    const py = clientY - dragStart.current.y;
    if (Math.hypot(px, py) > 6) dragMovedRef.current = true;
    const dx = px / curZoom;
    const dy = py / curZoom;
    let newX = dragStart.current.nodeX + dx;
    let newY = dragStart.current.nodeY + dy;

    if (viewPrefsRef.current.snapToGrid) {
      const g = viewPrefsRef.current.gridSize;
      const snap = (v: number) => Math.round(v / g) * g;
      newX = snap(newX);
      newY = snap(newY);
    }

    const dragNode = nodes.find((n) => n.id === id);
    const activeGuides: { type: "h" | "v"; pos: number }[] = [];
    if (dragNode) {
      const others = nodes.filter((n) => n.id !== id);
      const cx = newX + dragNode.w / 2;
      const cy = newY + dragNode.h / 2;
      for (const o of others) {
        const ocx = o.x + o.w / 2;
        const ocy = o.y + o.h / 2;
        if (Math.abs(newX - o.x) < GUIDE_THRESHOLD) {
          newX = o.x;
          activeGuides.push({ type: "v", pos: o.x });
        } else if (Math.abs(newX + dragNode.w - (o.x + o.w)) < GUIDE_THRESHOLD) {
          newX = o.x + o.w - dragNode.w;
          activeGuides.push({ type: "v", pos: o.x + o.w });
        } else if (Math.abs(cx - ocx) < GUIDE_THRESHOLD) {
          newX = ocx - dragNode.w / 2;
          activeGuides.push({ type: "v", pos: ocx });
        }
        if (Math.abs(newY - o.y) < GUIDE_THRESHOLD) {
          newY = o.y;
          activeGuides.push({ type: "h", pos: o.y });
        } else if (Math.abs(newY + dragNode.h - (o.y + o.h)) < GUIDE_THRESHOLD) {
          newY = o.y + o.h - dragNode.h;
          activeGuides.push({ type: "h", pos: o.y + o.h });
        } else if (Math.abs(cy - ocy) < GUIDE_THRESHOLD) {
          newY = ocy - dragNode.h / 2;
          activeGuides.push({ type: "h", pos: ocy });
        }
      }
    }
    setGuidesIfChanged(activeGuides);
    const offsetX = newX - dragStart.current.nodeX;
    const offsetY = newY - dragStart.current.nodeY;
    el.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  }, [dragId, nodes, setGuidesIfChanged]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const curZoom = zoomRef.current;
    const curPan = panRef.current;
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      applyLayerTransform(
        { x: panStart.current.panX + dx, y: panStart.current.panY + dy },
        curZoom,
      );
    }
    if (pendingDragRef.current && !dragId) {
      const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
      if (dist >= DRAG_ACTIVATE_PX) {
        const pending = pendingDragRef.current;
        clearNativeSelection();
        if (dragElRef.current) dragElRef.current.style.willChange = "transform";
        setDragId(pending.id);
        setPendingDragId(null);
        pendingDragRef.current = null;
      }
    }
    if (dragId && dragElRef.current) {
      dragPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = 0;
          const pt = dragPointerRef.current;
          if (pt && dragId) applyDragTransform(pt.clientX, pt.clientY);
        });
      }
    }
    if (resizeId && resizeElRef.current) {
      const dx = (e.clientX - resizeStart.current.x) / curZoom;
      const dy = (e.clientY - resizeStart.current.y) / curZoom;
      const resizing = nodes.find((n) => n.id === resizeId);
      const minW = resizing?.type === "backdrop" ? 48 : 120;
      const minH = resizing?.type === "backdrop" ? 48 : 80;
      const newW = Math.max(minW, resizeStart.current.w + dx);
      const newH = Math.max(minH, resizeStart.current.h + dy);
      resizeElRef.current.style.width = `${newW}px`;
      resizeElRef.current.style.height = `${newH}px`;
    }
    if (selBox) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - curPan.x) / curZoom;
      const wy = (e.clientY - rect.top - curPan.y) / curZoom;
      setSelBox({ x1: selStart.current.x, y1: selStart.current.y, x2: wx, y2: wy });
    }
  }, [isPanning, dragId, resizeId, selBox, applyLayerTransform, setGuidesIfChanged, applyDragTransform]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      commitChromeSync();
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (pendingDragRef.current && !dragId) {
      pendingDragRef.current = null;
      setPendingDragId(null);
      dragElRef.current = null;
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = 0;
    }
    if (dragId && dragElRef.current) {
      const dx = (e.clientX - dragStart.current.x) / zoomRef.current;
      const dy = (e.clientY - dragStart.current.y) / zoomRef.current;
      let finalX = dragStart.current.nodeX + dx;
      let finalY = dragStart.current.nodeY + dy;
      if (viewPrefsRef.current.snapToGrid) {
        const g = viewPrefsRef.current.gridSize;
        const snap = (v: number) => Math.round(v / g) * g;
        finalX = snap(finalX);
        finalY = snap(finalY);
      }
      dragElRef.current.style.transform = "";
      dragElRef.current.style.willChange = "";
      dragElRef.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === dragId ? { ...n, x: finalX, y: finalY } : n))
      );
      if (dragMovedRef.current) {
        const suppressClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        document.addEventListener("click", suppressClick, true);
        window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 0);
      }
      dragMovedRef.current = false;
      setDragId(null);
      setPendingDragId(null);
      guidesRef.current = [];
      setGuides([]);
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    } else if (dragId) {
      setDragId(null);
      setPendingDragId(null);
      guidesRef.current = [];
      setGuides([]);
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (resizeId && resizeElRef.current) {
      const dx = (e.clientX - resizeStart.current.x) / zoomRef.current;
      const dy = (e.clientY - resizeStart.current.y) / zoomRef.current;
      const resizing = nodes.find((n) => n.id === resizeId);
      const minW = resizing?.type === "backdrop" ? 48 : 120;
      const minH = resizing?.type === "backdrop" ? 48 : 80;
      const finalW = Math.max(minW, resizeStart.current.w + dx);
      const finalH = Math.max(minH, resizeStart.current.h + dy);
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
  }, [isPanning, dragId, resizeId, selBox, nodes, commitChromeSync]);

  const bringToFront = useCallback((id: string) => {
    const newZ = maxZ + 1;
    setMaxZ(newZ);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, zIndex: newZ } : n)));
  }, [maxZ]);

  const sendToBack = useCallback((id: string) => {
    setNodes((prev) => {
      const z = nextBackdropZIndex(prev.filter((n) => n.id !== id));
      return prev.map((n) => (n.id === id ? { ...n, zIndex: z } : n));
    });
  }, []);

  const bringForward = useCallback((id: string) => {
    setNodes((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((n) => n.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const current = sorted[idx]!;
      const above = sorted[idx + 1]!;
      return prev.map((n) => {
        if (n.id === current.id) return { ...n, zIndex: above.zIndex };
        if (n.id === above.id) return { ...n, zIndex: current.zIndex };
        return n;
      });
    });
  }, []);

  const sendBackward = useCallback((id: string) => {
    setNodes((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((n) => n.id === id);
      if (idx <= 0) return prev;
      const current = sorted[idx]!;
      const below = sorted[idx - 1]!;
      return prev.map((n) => {
        if (n.id === current.id) return { ...n, zIndex: below.zIndex };
        if (n.id === below.id) return { ...n, zIndex: current.zIndex };
        return n;
      });
    });
  }, []);

  const updateNodeGeometry = useCallback(
    (id: string, patch: Partial<Pick<CanvasNode, "x" | "y" | "w" | "h" | "rotation">>) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch };
          const minW = n.type === "backdrop" ? 48 : 120;
          const minH = n.type === "backdrop" ? 48 : 80;
          if (patch.w !== undefined) next.w = Math.max(minW, patch.w);
          if (patch.h !== undefined) next.h = Math.max(minH, patch.h);
          if (patch.rotation !== undefined) {
            next.rotation = Math.min(180, Math.max(-180, patch.rotation));
          }
          return next;
        }),
      );
    },
    [],
  );

  const updateNodeAppearance = useCallback(
    (id: string, patch: Partial<Pick<CanvasNode, "opacity" | "cornerRadius">>) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch };
          if (patch.opacity !== undefined) next.opacity = Math.min(1, Math.max(0.05, patch.opacity));
          if (patch.cornerRadius !== undefined) next.cornerRadius = Math.min(64, Math.max(0, patch.cornerRadius));
          return next;
        }),
      );
    },
    [],
  );

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    prepareCanvasPointerGesture(e);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    if (node.type !== "backdrop") bringToFront(id);
    dragMovedRef.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, nodeX: node.x, nodeY: node.y };
    const target = e.currentTarget as HTMLElement;
    dragElRef.current = target.closest(".canvas-item") as HTMLElement | null;
    pendingDragRef.current = {
      id,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
    setPendingDragId(id);
    if (!e.shiftKey) setSelected(new Set([id]));
    else setSelected((prev) => { const next = new Set(prev); next.add(id); return next; });
    try {
      viewportRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  }, [nodes, bringToFront]);

  const startResize = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    prepareCanvasPointerGesture(e);
    const node = nodes.find((n) => n.id === id);
    if (node?.type !== "backdrop") bringToFront(id);
    if (!node) return;
    setResizeId(id);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: node.w, h: node.h };
    const handle = e.currentTarget as HTMLElement;
    resizeElRef.current = handle.closest(".canvas-item") as HTMLElement | null;
    if (resizeElRef.current) resizeElRef.current.style.willChange = "width, height";
  }, [nodes, bringToFront]);

  const duplicateNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const newId = generateId();
      const newZ = maxZ + 1;
      setMaxZ(newZ);
      setNodes((prev) => [
        ...prev,
        {
          ...node,
          id: newId,
          x: node.x + 28,
          y: node.y + 28,
          zIndex: newZ,
        },
      ]);
      setSelected(new Set([newId]));
    },
    [nodes, maxZ],
  );

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const viewCenter = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 800;
    const ch = containerRef.current?.clientHeight ?? 600;
    return { x: (-pan.x + cw / 2) / zoom, y: (-pan.y + ch / 2) / zoom };
  }, [pan, zoom]);

  const addWidget = useCallback(
    (widgetKey: string, variant: WidgetSizeVariant = "medium", skin?: WidgetSkin, display?: string) => {
      const newZ = maxZ + 1;
      setMaxZ(newZ);
      const c = viewCenter();
      const style = buildWidgetRenderStyle(widgetKey, variant, skin, display);
      const preset = getVariantPreset(widgetKey, style.variant);
      setNodes((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "widget",
          x: c.x - preset.w / 2,
          y: c.y - preset.h / 2,
          w: preset.w,
          h: preset.h,
          widgetKey,
          widgetVariant: style.variant,
          widgetSkin: style.skin,
          widgetDisplay: style.display,
          zIndex: newZ,
        },
      ]);
    },
    [maxZ, viewCenter],
  );

  const addWidgetFromRegistry = useCallback(
    (entry: WidgetRegistryEntry, variant?: import("../../dashboard/types").WidgetSizeVariant) => {
      addWidget(
        entry.key,
        variant ?? entry.defaultVariant,
        entry.defaultSkin,
        entry.defaultDisplay,
      );
    },
    [addWidget],
  );

  const resetDashboardLayout = useCallback(() => {
    const fresh = createDefaultDashboardNodes();
    const topZ = fresh.reduce((m, n) => Math.max(m, n.zIndex), 0);
    setNodes(fresh);
    setMaxZ(topZ);
    setSelected(new Set());
    setEditMode(true);
  }, []);

  const widgetNodeCount = nodes.filter((n) => n.type === "widget").length;
  const showEmptyOnboarding = widgetNodeCount === 0;

  const setWidgetVariant = useCallback((id: string, variant: WidgetSizeVariant) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id || n.type !== "widget" || !n.widgetKey) return n;
        const widgetVariant = normalizeWidgetVariant(n.widgetKey, variant);
        const preset = getVariantPreset(n.widgetKey, widgetVariant);
        return { ...n, widgetVariant, w: preset.w, h: preset.h };
      }),
    );
  }, []);

  const setWidgetStyle = useCallback(
    (id: string, patch: { skin?: WidgetSkin; display?: string; variant?: WidgetSizeVariant }) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id || n.type !== "widget" || !n.widgetKey) return n;
          const style = buildWidgetRenderStyle(
            n.widgetKey,
            patch.variant ?? n.widgetVariant,
            patch.skin ?? n.widgetSkin,
            patch.display ?? n.widgetDisplay,
          );
          const preset = getVariantPreset(n.widgetKey, style.variant);
          return {
            ...n,
            widgetVariant: style.variant,
            widgetSkin: style.skin,
            widgetDisplay: style.display,
            w: preset.w,
            h: preset.h,
          };
        }),
      );
    },
    [],
  );

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

  const addBackdrop = useCallback((color: string = DEFAULT_BACKDROP_COLOR) => {
    const c = viewCenter();
    setNodes((prev) => {
      const z = nextBackdropZIndex(prev);
      return [
        ...prev,
        normalizeBackdrop({
          id: generateId(),
          type: "backdrop",
          x: c.x - 200,
          y: c.y - 140,
          w: 400,
          h: 280,
          backdropColor: color,
          backdropOpacity: 0.45,
          backdropRadius: 16,
          backdropBorderWidth: 0,
          zIndex: z,
        }),
      ];
    });
  }, [viewCenter]);

  const updateBackdrop = useCallback(
    (id: string, patch: Partial<Pick<CanvasNode, "backdropColor" | "backdropOpacity" | "backdropRadius" | "backdropBorderWidth" | "backdropBorderColor">>) => {
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    [],
  );

  const updateNodeContent = useCallback((id: string, content: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
  }, []);

  const updateNodeTitle = useCallback((id: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
  }, []);

  const updateWidgetConfig = useCallback((id: string, widgetConfig: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, widgetConfig };
        const title = widgetConfig.title;
        if (typeof title === "string" && title.trim()) {
          next.title = title.trim();
        }
        return next;
      }),
    );
  }, []);

  // Animated zoom for toolbar buttons
  const animateZoom = useCallback((targetZoom: number) => {
    cancelAnimationFrame(zoomAnimRef.current);
    const rect = viewportRef.current?.getBoundingClientRect();
    const clampedTarget = clampZoom(targetZoom);
    if (!rect) {
      applyLayerTransform(panRef.current, clampedTarget);
      commitChromeSync();
      return;
    }

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const startZoom = zoomRef.current;
    const startPan = { ...panRef.current };
    const start = performance.now();
    const duration = 120;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const z = startZoom + (clampedTarget - startZoom) * ease;
      const ratio = z / startZoom;
      applyLayerTransform(
        { x: cx - ratio * (cx - startPan.x), y: cy - ratio * (cy - startPan.y) },
        z,
      );
      if (t < 1) {
        zoomAnimRef.current = requestAnimationFrame(step);
      } else {
        commitChromeSync();
      }
    };
    zoomAnimRef.current = requestAnimationFrame(step);
  }, [applyLayerTransform, commitChromeSync]);

  const zoomIn = () => animateZoom(clampZoom(zoomRef.current * 1.25));
  const zoomOut = () => animateZoom(clampZoom(zoomRef.current / 1.25));
  const zoomTo = (target: number) => animateZoom(clampZoom(target));

  const fitToBoard = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { pan: fitPan, zoom: fitZoom } = computeFitView(
      nodes,
      rect.width,
      rect.height,
    );
    animateZoom(fitZoom);
    window.setTimeout(() => {
      applyLayerTransform(fitPan, fitZoom);
      commitChromeSync();
    }, 130);
  }, [nodes, animateZoom, applyLayerTransform, commitChromeSync]);

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

  // Selection box in screen coords
  const selRect = selBox ? {
    left: Math.min(selBox.x1, selBox.x2) * zoom + pan.x,
    top: Math.min(selBox.y1, selBox.y2) * zoom + pan.y,
    width: Math.abs(selBox.x2 - selBox.x1) * zoom,
    height: Math.abs(selBox.y2 - selBox.y1) * zoom,
  } : null;

  const selectedId = selected.size === 1 ? [...selected][0]! : null;
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;
  const chromeDockRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = chromeDockRef.current;
    const root = containerRef.current;
    if (!el || !root) return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      root.style.setProperty("--canvas-chrome-dock-h", `${Math.ceil(h)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedNode?.id, selectedNode?.type, editMode]);

  return (
    <div
      className={`canvas-dashboard canvas-dashboard--fixed-chrome${editMode ? " canvas-dashboard--edit-mode" : ""}`}
      data-ui-density={ui.density}
      data-surface-tone={ui.surfaceTone}
      ref={containerRef}
    >
      <WidgetLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onAdd={addWidgetFromRegistry}
      />
      <div
        className={`canvas-chrome-stack${editMode ? " canvas-chrome-stack--edit-mode" : ""}${selectedNode ? " canvas-chrome-stack--has-selection" : ""}`}
        ref={chromeDockRef}
      >
        <div className={`canvas-chrome-dock${selectedNode ? " canvas-chrome-dock--has-selection" : ""}`}>
        <div className={`canvas-unified-toolbar${editMode || selectedNode ? " canvas-unified-toolbar--expanded" : ""}`}>
          {renderWidget ? (
            <div className="canvas-unified-toolbar__row canvas-unified-toolbar__row--nav">
              <HomeGlanceBar compact onNavigate={onNavigate} onCommand={onCommand} />
            </div>
          ) : null}
          <div className="canvas-unified-toolbar__row canvas-unified-toolbar__row--main canvas-unified-toolbar__row--toolbar">
            <CanvasToolbar
              embedded
              zoom={zoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={() => zoomTo(1)}
              editMode={editMode}
              onToggleEditMode={() => setEditMode((v) => !v)}
              onOpenWidgetLibrary={() => {
                setLibraryOpen(true);
                setEditMode(true);
              }}
              onResetLayout={resetDashboardLayout}
              widgetCount={widgetNodeCount}
              onAddWidget={addWidget}
              onAddImage={addImage}
              onAddNote={addNote}
              onAddCustom={addCustom}
              onAddEmbed={addEmbed}
              onAddBackdrop={addBackdrop}
              background={background}
              onBackgroundChange={onBackgroundChange}
            />
          </div>
          {editMode ? (
            <div className="canvas-unified-toolbar__row canvas-unified-toolbar__row--secondary">
              <DashboardCustomizeStrip />
            </div>
          ) : null}
          {selectedNode ? (
            <div className="canvas-unified-toolbar__row canvas-unified-toolbar__row--selection">
              <CanvasSelectionToolbar
                embedded
                preferExpanded={false}
                node={selectedNode}
                  onGeometryChange={(patch) => updateNodeGeometry(selectedNode.id, patch)}
                  onAppearanceChange={
                    selectedNode.type !== "backdrop"
                      ? (patch) => updateNodeAppearance(selectedNode.id, patch)
                      : undefined
                  }
                  onWidgetStyleChange={
                    selectedNode.type === "widget"
                      ? (patch) => setWidgetStyle(selectedNode.id, patch)
                      : undefined
                  }
                  onWidgetConfigChange={
                    selectedNode.type === "widget"
                      ? (config) => updateWidgetConfig(selectedNode.id, config)
                      : undefined
                  }
                  onBackdropChange={
                    selectedNode.type === "backdrop"
                      ? (patch) => updateBackdrop(selectedNode.id, patch)
                      : undefined
                  }
                  onBringForward={() => bringForward(selectedNode.id)}
                  onSendForward={() => bringToFront(selectedNode.id)}
                  onSendBackward={() => sendBackward(selectedNode.id)}
                  onSendToBack={() => sendToBack(selectedNode.id)}
                  onDuplicate={() => duplicateNode(selectedNode.id)}
                  onRemove={() => removeNode(selectedNode.id)}
                  onClearSelection={() => setSelected(new Set())}
                />
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-viewport${isPanning ? " canvas-viewport--panning" : ""}${dragId || pendingDragId ? " canvas-viewport--dragging" : ""}${resizeId ? " canvas-viewport--resizing" : ""}${selBox ? " canvas-viewport--selecting" : ""}${isPanning || dragId || pendingDragId || resizeId || selBox ? " canvas-viewport--interacting" : ""}${viewPrefs.showGrid ? "" : " canvas-viewport--no-grid"}${viewPrefs.gridStyle === "lines" ? " canvas-viewport--grid-lines" : ""}`}
        onWheel={onWheel}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        style={canvasBackgroundCss(background) as React.CSSProperties}
      >
        {showEmptyOnboarding && (
          <DashboardEmptyState
            onCustomize={() => setEditMode(true)}
            onAddWidget={() => {
              setEditMode(true);
              setLibraryOpen(true);
            }}
          />
        )}
        <div
          ref={layerRef}
          className={`canvas-layer${isPanning || dragId || resizeId ? " canvas-layer--active" : ""}`}
        >
          {[...nodes]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((node) => (
            <CanvasItem
              key={node.id}
              node={node}
              widgets={widgets}
              renderWidget={renderWidget}
              editMode={editMode}
              isSelected={selected.has(node.id)}
              onDragStart={(e) => startDrag(node.id, e)}
              onResizeStart={(e) => startResize(node.id, e)}
              onRemove={() => removeNode(node.id)}
              onContentChange={(c) => updateNodeContent(node.id, c)}
              onTitleChange={(t) => updateNodeTitle(node.id, t)}
              onWidgetStyleChange={
                node.type === "widget"
                  ? (patch) => setWidgetStyle(node.id, patch)
                  : undefined
              }
              onBackdropChange={
                node.type === "backdrop"
                  ? (patch) => updateBackdrop(node.id, patch)
                  : undefined
              }
              onSendToBack={node.type === "backdrop" ? () => sendToBack(node.id) : undefined}
            />
          ))}
        </div>

        {/* Alignment guides */}
        {guides.map((g, i) => (
          <div
            key={`guide-${i}`}
            className={`canvas-guide canvas-guide--${g.type}`}
            style={
              g.type === "h"
                ? { top: g.pos * zoom + pan.y, left: 0, right: 0 }
                : { left: g.pos * zoom + pan.x, top: 0, bottom: 0 }
            }
          />
        ))}

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

      <CanvasViewControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomTo={zoomTo}
        onFit={fitToBoard}
        prefs={viewPrefs}
        onPrefsChange={patchViewPrefs}
      />

      <div className="canvas-hints">
        Scroll to pan · Ctrl/Alt+scroll to zoom · Grid & snap bottom-right · Shift+drag to select
      </div>
    </div>
  );
}
