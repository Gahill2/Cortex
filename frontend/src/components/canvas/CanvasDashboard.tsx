import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Tab } from "../../App";
import type { ReactNode } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { CanvasLayoutPref } from "../../lib/preferencesTypes";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasWidgetInspectorInline } from "./CanvasWidgetInspectorInline";
import { CanvasItem } from "./CanvasItem";
import { CanvasMinimap } from "./CanvasMinimap";
import {
  type CanvasBackground,
  CANVAS_AMBIENT_PRESETS,
  ambientHorizonPalette,
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
import { isBackgroundCanvasTarget, prepareCanvasPointerGesture } from "./canvasPointer";
import { clearNativeSelection } from "./canvasSelection";
import { DEFAULT_BACKDROP_COLOR } from "./backdropColors";
import {
  loadCanvasFromLocalStorage,
  mergeCanvasImageUrlsFromLocal,
  migrateCanvasDataUrlImages,
} from "../../lib/canvasState";
import { createDefaultDashboardNodes, createStarterDashboardNodes } from "../../dashboard/defaultLayout";
import {
  clearProductivityLayoutAfterMigration,
  tryMigrateProductivityLayoutToCanvas,
} from "../../lib/migrateProductivityLayoutToCanvas";
import { WidgetLibrary } from "../../dashboard/WidgetLibrary";
import { DashboardEmptyState } from "../../dashboard/DashboardEmptyState";
import type { WidgetRegistryEntry } from "../../dashboard/types";
import {
  WidgetComposerDialog,
  type ImageInsertPayload,
  type WidgetComposerState,
  type WidgetInsertPayload,
} from "./WidgetComposerDialog";
import { useCanvasViewPrefs } from "./canvasViewPrefs";
import { computeFitView } from "./canvasFit";
import { CanvasViewControls } from "./CanvasViewControls";
import { HomeGlanceBar } from "../home/HomeGlanceBar";
import { DashboardCustomizeStrip } from "./DashboardCustomizeStrip";
import { DashboardTypographyToolbar } from "./DashboardTypographyToolbar";
import { useUiCustomization } from "../../hooks/useUiCustomization";
import { stripBakedWidgetTypography } from "../../lib/uiCustomization";
import { runRafAnimation, springOut } from "./canvasMotion";

const MAX_GUIDES = 8;
const DRAG_LIFT_SCALE = 1.012;
const PAN_ACTIVATE_PX = 8;

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
  /** When true, item cannot be dragged or resized on the canvas */
  locked?: boolean;
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
const CANVAS_STATE_VERSION = 2;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.0015;
const SNAP_THRESHOLD = 8;
const GUIDE_THRESHOLD = 6;

const MemoCanvasItem = memo(
  CanvasItem,
  (prev, next) =>
    prev.node === next.node &&
    prev.isSelected === next.isSelected &&
    prev.editMode === next.editMode &&
    prev.widgets === next.widgets &&
    prev.renderWidget === next.renderWidget &&
    prev.onSelect === next.onSelect,
);

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
    const widgetConfig = stripBakedWidgetTypography(n.widgetConfig);
    return {
      ...n,
      widgetVariant: style.variant,
      widgetSkin: style.skin,
      widgetDisplay: style.display,
      w: n.w || preset.w,
      h: n.h || preset.h,
      widgetConfig,
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
      const parsed = JSON.parse(raw) as {
        version?: number;
        nodes: CanvasNode[];
        pan: { x: number; y: number };
        zoom: number;
      };
      if (parsed.version !== CANVAS_STATE_VERSION) {
        return null;
      }
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
  return createStarterDashboardNodes();
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  const [composerState, setComposerState] = useState<WidgetComposerState | null>(null);
  const [maxZ, setMaxZ] = useState(() =>
    Math.max(...(saved?.nodes ?? initialCanvasNodes()).map((n) => n.zIndex), 0),
  );
  const [background, setBackground] = useState<CanvasBackground>(loadCanvasBackground);
  // Hour bucket so adaptive ambient palettes (Horizon) follow the time of day.
  const [ambientHour, setAmbientHour] = useState(() => new Date().getHours());
  const ambientPreset =
    background.kind === "ambient"
      ? (CANVAS_AMBIENT_PRESETS.find((p) => p.id === background.presetId) ??
        CANVAS_AMBIENT_PRESETS[0])
      : null;
  const ambientPalette = ambientPreset
    ? ambientPreset.adaptive
      ? ambientHorizonPalette(ambientHour)
      : ambientPreset
    : null;
  useEffect(() => {
    if (background.kind !== "ambient") return;
    const t = window.setInterval(() => setAmbientHour(new Date().getHours()), 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [background.kind]);

  // Staggered widget entrance on board load (flag lifted once settled).
  const [entranceChoreo, setEntranceChoreo] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setEntranceChoreo(false), 2000);
    return () => window.clearTimeout(t);
  }, []);

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
  const zoomAnimRef = useRef<{ cancel: () => void } | null>(null);
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
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const isPanningRef = useRef(false);
  const dragIdRef = useRef<string | null>(null);
  const resizeIdRef = useRef<string | null>(null);
  const pointerRef = useRef({ clientX: 0, clientY: 0 });
  const interactionRafRef = useRef(0);
  const panMomentumRafRef = useRef(0);
  const panVelocityRef = useRef({ vx: 0, vy: 0 });
  const lastPanSampleRef = useRef({ x: 0, y: 0, t: 0 });
  const DRAG_ACTIVATE_PX = 5;
  const resizeElRef = useRef<HTMLElement | null>(null);
  const guidesDataRef = useRef<{ type: "h" | "v"; pos: number }[]>([]);
  const guideElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const selBoxElRef = useRef<HTMLDivElement | null>(null);
  const selBoxActiveRef = useRef(false);
  const selBoxDataRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

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
      layer.style.setProperty("--canvas-zoom", String(Math.max(0.15, z)));
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
      zoomAnimRef.current?.cancel();
      if (interactionRafRef.current) cancelAnimationFrame(interactionRafRef.current);
      if (panMomentumRafRef.current) cancelAnimationFrame(panMomentumRafRef.current);
    };
  }, []);

  const syncViewportInteractionClasses = useCallback(() => {
    const vp = viewportRef.current;
    const layer = layerRef.current;
    const interacting =
      isPanningRef.current ||
      !!dragIdRef.current ||
      !!pendingDragRef.current ||
      !!resizeIdRef.current ||
      selBoxActiveRef.current;
    if (vp) {
      vp.classList.toggle("canvas-viewport--panning", isPanningRef.current);
      vp.classList.toggle(
        "canvas-viewport--dragging",
        !!(dragIdRef.current || pendingDragRef.current),
      );
      vp.classList.toggle("canvas-viewport--resizing", !!resizeIdRef.current);
      vp.classList.toggle("canvas-viewport--selecting", selBoxActiveRef.current);
      vp.classList.toggle("canvas-viewport--interacting", interacting);
    }
    if (layer) {
      layer.classList.toggle(
        "canvas-layer--active",
        !!(isPanningRef.current || dragIdRef.current || resizeIdRef.current),
      );
    }
  }, []);

  const paintGuides = useCallback((activeGuides: { type: "h" | "v"; pos: number }[]) => {
    const p = panRef.current;
    const z = zoomRef.current;
    guidesDataRef.current = activeGuides;
    for (let i = 0; i < MAX_GUIDES; i++) {
      const el = guideElsRef.current[i];
      if (!el) continue;
      const g = activeGuides[i];
      if (!g) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "block";
      el.className = `canvas-guide canvas-guide--${g.type} canvas-guide--visible`;
      if (g.type === "h") {
        el.style.top = `${g.pos * z + p.y}px`;
        el.style.left = "0";
        el.style.right = "0";
        el.style.bottom = "auto";
        el.style.width = "";
      } else {
        el.style.left = `${g.pos * z + p.x}px`;
        el.style.top = "0";
        el.style.bottom = "0";
        el.style.right = "auto";
        el.style.height = "";
      }
    }
  }, []);

  const clearGuides = useCallback(() => {
    guidesDataRef.current = [];
    for (const el of guideElsRef.current) {
      if (el) el.style.display = "none";
    }
  }, []);

  const paintSelBox = useCallback((box: { x1: number; y1: number; x2: number; y2: number }) => {
    const el = selBoxElRef.current;
    if (!el) return;
    const z = zoomRef.current;
    const p = panRef.current;
    el.style.display = "block";
    el.style.left = `${Math.min(box.x1, box.x2) * z + p.x}px`;
    el.style.top = `${Math.min(box.y1, box.y2) * z + p.y}px`;
    el.style.width = `${Math.abs(box.x2 - box.x1) * z}px`;
    el.style.height = `${Math.abs(box.y2 - box.y1) * z}px`;
  }, []);

  const hideSelBox = useCallback(() => {
    const el = selBoxElRef.current;
    if (el) el.style.display = "none";
    selBoxActiveRef.current = false;
    selBoxDataRef.current = null;
    syncViewportInteractionClasses();
  }, [syncViewportInteractionClasses]);

  const playDropSettle = useCallback((el: HTMLElement) => {
    el.classList.remove("canvas-item--lifted");
    el.style.transform = "";
    el.style.willChange = "";
    el.classList.add("canvas-item--drop-settle");
    const cleanup = () => {
      el.classList.remove("canvas-item--drop-settle");
      el.removeEventListener("animationend", cleanup);
    };
    el.addEventListener("animationend", cleanup);
    window.setTimeout(cleanup, 420);
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
      let versionStale = false;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { version?: number };
          versionStale = parsed.version !== CANVAS_STATE_VERSION;
        } else {
          versionStale = true;
        }
      } catch {
        versionStale = true;
      }

      // First run (no server layout at all) seeds the curated starter board;
      // an intentionally emptied board (server layout with no nodes) stays empty.
      let nextNodes = layout?.nodes?.length
        ? normalizeNodes(layout.nodes)
        : !versionStale && local?.nodes?.length
          ? normalizeNodes(local.nodes)
          : !versionStale && saved?.nodes?.length
            ? normalizeNodes(saved.nodes)
            : layout
              ? []
              : normalizeNodes(initialCanvasNodes());

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
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: CANVAS_STATE_VERSION, nodes, pan, zoom }),
        );
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

  const enterCustomizeMode = useCallback(() => {
    setEditMode(true);
    setLibraryOpen(true);
  }, [setEditMode, setLibraryOpen]);

  const exitCustomizeMode = useCallback(() => {
    setEditMode(false);
    setLibraryOpen(false);
    setComposerState(null);
    setSelected(new Set());
  }, [setEditMode, setLibraryOpen]);

  const libraryOpenRef = useRef(libraryOpen);
  libraryOpenRef.current = libraryOpen;

  const handleBackgroundTap = useCallback(() => {
    if (selected.size > 0) {
      setSelected(new Set());
      return;
    }
    if (editModeRef.current || libraryOpenRef.current) {
      exitCustomizeMode();
    }
  }, [exitCustomizeMode, selected.size]);

  const selectCanvasItem = useCallback(
    (id: string) => {
      setSelected(new Set([id]));
      setEditMode(true);
      setLibraryOpen(false);
    },
    [setEditMode, setLibraryOpen],
  );

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

  const computeDragSnap = useCallback((clientX: number, clientY: number) => {
    const id = dragIdRef.current;
    if (!id) return null;
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

    const nodesList = nodesRef.current;
    const dragNode = nodesList.find((n) => n.id === id);
    const activeGuides: { type: "h" | "v"; pos: number }[] = [];
    if (dragNode) {
      const others = nodesList.filter((n) => n.id !== id);
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
    return {
      newX,
      newY,
      offsetX: newX - dragStart.current.nodeX,
      offsetY: newY - dragStart.current.nodeY,
      activeGuides,
    };
  }, []);

  const applyDragTransform = useCallback(
    (clientX: number, clientY: number) => {
      const el = dragElRef.current;
      if (!el || !dragIdRef.current) return;
      const snap = computeDragSnap(clientX, clientY);
      if (!snap) return;
      const prev = guidesDataRef.current;
      const next = snap.activeGuides;
      if (
        prev.length !== next.length ||
        !prev.every((g, i) => g.type === next[i]?.type && g.pos === next[i]?.pos)
      ) {
        paintGuides(next);
      }
      el.style.transform = `translate3d(${snap.offsetX}px, ${snap.offsetY}px, 0) scale(${DRAG_LIFT_SCALE})`;
    },
    [computeDragSnap, paintGuides],
  );

  const applyResizeTransform = useCallback((clientX: number, clientY: number) => {
    const el = resizeElRef.current;
    const id = resizeIdRef.current;
    if (!el || !id) return;
    const curZoom = zoomRef.current;
    const dx = (clientX - resizeStart.current.x) / curZoom;
    const dy = (clientY - resizeStart.current.y) / curZoom;
    const resizing = nodesRef.current.find((n) => n.id === id);
    const minW = resizing?.type === "backdrop" ? 48 : 120;
    const minH = resizing?.type === "backdrop" ? 48 : 80;
    el.style.width = `${Math.max(minW, resizeStart.current.w + dx)}px`;
    el.style.height = `${Math.max(minH, resizeStart.current.h + dy)}px`;
  }, []);

  const stopInteractionLoop = useCallback(() => {
    if (interactionRafRef.current) {
      cancelAnimationFrame(interactionRafRef.current);
      interactionRafRef.current = 0;
    }
  }, []);

  const startInteractionLoop = useCallback(() => {
    if (interactionRafRef.current) return;
    const tick = () => {
      const ptr = pointerRef.current;
      if (isPanningRef.current) {
        const dx = ptr.clientX - panStart.current.x;
        const dy = ptr.clientY - panStart.current.y;
        applyLayerTransform(
          { x: panStart.current.panX + dx, y: panStart.current.panY + dy },
          zoomRef.current,
        );
        const now = performance.now();
        const dt = Math.max(now - lastPanSampleRef.current.t, 1);
        panVelocityRef.current = {
          vx: ((ptr.clientX - lastPanSampleRef.current.x) / dt) * 16,
          vy: ((ptr.clientY - lastPanSampleRef.current.y) / dt) * 16,
        };
        lastPanSampleRef.current = { x: ptr.clientX, y: ptr.clientY, t: now };
      }
      if (dragIdRef.current && dragElRef.current) {
        applyDragTransform(ptr.clientX, ptr.clientY);
      }
      if (resizeIdRef.current && resizeElRef.current) {
        applyResizeTransform(ptr.clientX, ptr.clientY);
      }
      if (selBoxActiveRef.current) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const z = zoomRef.current;
          const p = panRef.current;
          const wx = (ptr.clientX - rect.left - p.x) / z;
          const wy = (ptr.clientY - rect.top - p.y) / z;
          const box = {
            x1: selStart.current.x,
            y1: selStart.current.y,
            x2: wx,
            y2: wy,
          };
          selBoxDataRef.current = box;
          paintSelBox(box);
        }
      }
      const active =
        isPanningRef.current ||
        !!dragIdRef.current ||
        !!resizeIdRef.current ||
        selBoxActiveRef.current;
      if (active) {
        interactionRafRef.current = requestAnimationFrame(tick);
      } else {
        interactionRafRef.current = 0;
      }
    };
    interactionRafRef.current = requestAnimationFrame(tick);
  }, [applyLayerTransform, applyDragTransform, applyResizeTransform, paintSelBox]);

  const runPanMomentum = useCallback(() => {
    cancelAnimationFrame(panMomentumRafRef.current);
    let vx = panVelocityRef.current.vx;
    let vy = panVelocityRef.current.vy;
    if (Math.hypot(vx, vy) < 0.45) {
      commitChromeSync();
      return;
    }
    const decay = 0.9;
    const step = () => {
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) < 0.25) {
        panMomentumRafRef.current = 0;
        commitChromeSync();
        return;
      }
      const p = panRef.current;
      applyLayerTransform({ x: p.x + vx, y: p.y + vy }, zoomRef.current);
      panMomentumRafRef.current = requestAnimationFrame(step);
    };
    panMomentumRafRef.current = requestAnimationFrame(step);
  }, [applyLayerTransform, commitChromeSync]);

  // ── Pan / marquee pointer handlers ────────────────────────────────────────
  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      const curPan = panRef.current;
      cancelAnimationFrame(panMomentumRafRef.current);
      panMomentumRafRef.current = 0;
      isPanningRef.current = true;
      panStart.current = { x: clientX, y: clientY, panX: curPan.x, panY: curPan.y };
      lastPanSampleRef.current = { x: clientX, y: clientY, t: performance.now() };
      panVelocityRef.current = { vx: 0, vy: 0 };
      syncViewportInteractionClasses();
      startInteractionLoop();
    },
    [startInteractionLoop, syncViewportInteractionClasses],
  );

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const onBackground = isBackgroundCanvasTarget(e.target);
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    if (e.button === 1) {
      prepareCanvasPointerGesture(e);
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      beginPan(e.clientX, e.clientY);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (e.button === 0 && onBackground && !e.shiftKey) {
      prepareCanvasPointerGesture(e);
      pendingPanRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
    } else if (e.button === 0 && onBackground && e.shiftKey) {
      prepareCanvasPointerGesture(e);
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - curPan.x) / curZoom;
      const wy = (e.clientY - rect.top - curPan.y) / curZoom;
      selStart.current = { x: wx, y: wy };
      selBoxActiveRef.current = true;
      selBoxDataRef.current = { x1: wx, y1: wy, x2: wx, y2: wy };
      paintSelBox(selBoxDataRef.current);
      syncViewportInteractionClasses();
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      startInteractionLoop();
      if (!e.ctrlKey && !e.metaKey) setSelected(new Set());
    }
  }, [paintSelBox, startInteractionLoop, syncViewportInteractionClasses, beginPan]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    const pendingPan = pendingPanRef.current;
    if (pendingPan && !isPanningRef.current) {
      const dist = Math.hypot(e.clientX - pendingPan.x, e.clientY - pendingPan.y);
      if (dist >= PAN_ACTIVATE_PX) {
        pendingPanRef.current = null;
        beginPan(pendingPan.x, pendingPan.y);
      }
    }
    if (pendingDragRef.current && !dragIdRef.current) {
      const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
      if (dist >= DRAG_ACTIVATE_PX) {
        const pending = pendingDragRef.current;
        clearNativeSelection();
        dragIdRef.current = pending.id;
        pendingDragRef.current = null;
        if (dragElRef.current) {
          dragElRef.current.style.willChange = "transform";
          dragElRef.current.classList.add("canvas-item--lifted");
        }
        syncViewportInteractionClasses();
        startInteractionLoop();
      }
    }
    if (
      isPanningRef.current ||
      dragIdRef.current ||
      resizeIdRef.current ||
      selBoxActiveRef.current
    ) {
      startInteractionLoop();
    }
  }, [beginPan, startInteractionLoop, syncViewportInteractionClasses]);

  const onCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    const pendingPan = pendingPanRef.current;
    if (pendingPan && !isPanningRef.current) {
      pendingPanRef.current = null;
      handleBackgroundTap();
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
      syncViewportInteractionClasses();
      runPanMomentum();
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (pendingDragRef.current && !dragIdRef.current) {
      pendingDragRef.current = null;
      dragElRef.current = null;
      syncViewportInteractionClasses();
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    const releasedDragId = dragIdRef.current;
    const releasedDragEl = dragElRef.current;
    if (releasedDragId && releasedDragEl) {
      const snap = computeDragSnap(e.clientX, e.clientY);
      const finalX = snap?.newX ?? dragStart.current.nodeX;
      const finalY = snap?.newY ?? dragStart.current.nodeY;
      dragIdRef.current = null;
      dragElRef.current = null;
      clearGuides();
      setNodes((prev) =>
        prev.map((n) => (n.id === releasedDragId ? { ...n, x: finalX, y: finalY } : n)),
      );
      playDropSettle(releasedDragEl);
      if (dragMovedRef.current) {
        const suppressClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        document.addEventListener("click", suppressClick, true);
        window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 0);
      }
      dragMovedRef.current = false;
      syncViewportInteractionClasses();
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    } else if (releasedDragId) {
      dragIdRef.current = null;
      clearGuides();
      syncViewportInteractionClasses();
      try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    const releasedResizeId = resizeIdRef.current;
    if (releasedResizeId && resizeElRef.current) {
      const dx = (e.clientX - resizeStart.current.x) / zoomRef.current;
      const dy = (e.clientY - resizeStart.current.y) / zoomRef.current;
      const resizing = nodesRef.current.find((n) => n.id === releasedResizeId);
      const minW = resizing?.type === "backdrop" ? 48 : 120;
      const minH = resizing?.type === "backdrop" ? 48 : 80;
      const finalW = Math.max(minW, resizeStart.current.w + dx);
      const finalH = Math.max(minH, resizeStart.current.h + dy);
      const resizeEl = resizeElRef.current;
      resizeEl.style.width = "";
      resizeEl.style.height = "";
      resizeEl.style.willChange = "";
      resizeElRef.current = null;
      resizeIdRef.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === releasedResizeId ? { ...n, w: finalW, h: finalH } : n)),
      );
      playDropSettle(resizeEl);
      syncViewportInteractionClasses();
    } else if (releasedResizeId) {
      resizeIdRef.current = null;
      syncViewportInteractionClasses();
    }
    const selBox = selBoxDataRef.current;
    if (selBoxActiveRef.current && selBox) {
      const bx1 = Math.min(selBox.x1, selBox.x2);
      const by1 = Math.min(selBox.y1, selBox.y2);
      const bx2 = Math.max(selBox.x1, selBox.x2);
      const by2 = Math.max(selBox.y1, selBox.y2);
      const hits = nodesRef.current
        .filter((n) => n.x + n.w > bx1 && n.x < bx2 && n.y + n.h > by1 && n.y < by2)
        .map((n) => n.id);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of hits) next.add(id);
        return next;
      });
      hideSelBox();
    }
    stopInteractionLoop();
  }, [
    computeDragSnap,
    clearGuides,
    playDropSettle,
    runPanMomentum,
    hideSelBox,
    stopInteractionLoop,
    syncViewportInteractionClasses,
    handleBackgroundTap,
  ]);

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

  const toggleNodeLock = useCallback((id: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, locked: !n.locked } : n)),
    );
  }, []);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    prepareCanvasPointerGesture(e);
    const node = nodes.find((n) => n.id === id);
    if (!node || node.locked) return;
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
    syncViewportInteractionClasses();
    if (!e.shiftKey) setSelected(new Set([id]));
    else setSelected((prev) => { const next = new Set(prev); next.add(id); return next; });
    try {
      viewportRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  }, [nodes, bringToFront, syncViewportInteractionClasses]);

  const startResize = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    prepareCanvasPointerGesture(e);
    const node = nodes.find((n) => n.id === id);
    if (!node || node.locked) return;
    if (node.type !== "backdrop") bringToFront(id);
    resizeIdRef.current = id;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: node.w, h: node.h };
    pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    const handle = e.currentTarget as HTMLElement;
    resizeElRef.current = handle.closest(".canvas-item") as HTMLElement | null;
    if (resizeElRef.current) {
      resizeElRef.current.style.willChange = "width, height";
      resizeElRef.current.classList.add("canvas-item--lifted");
    }
    syncViewportInteractionClasses();
    startInteractionLoop();
  }, [nodes, bringToFront, syncViewportInteractionClasses, startInteractionLoop]);

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
    (
      widgetKey: string,
      variant: WidgetSizeVariant = "medium",
      skin?: WidgetSkin,
      display?: string,
      opts?: {
        title?: string;
        textSizePx?: number;
        textScale?: number;
        widgetConfig?: Record<string, unknown>;
      },
    ) => {
      const newZ = maxZ + 1;
      setMaxZ(newZ);
      const c = viewCenter();
      const style = buildWidgetRenderStyle(widgetKey, variant, skin, display);
      const preset = getVariantPreset(widgetKey, style.variant);
      const widgetConfig: Record<string, unknown> = { ...(opts?.widgetConfig ?? {}) };
      if (opts?.textSizePx != null || opts?.textScale != null) {
        if (opts.textSizePx != null) widgetConfig.textSizePx = opts.textSizePx;
        if (opts.textScale != null) widgetConfig.textScale = opts.textScale;
        widgetConfig.typographyCustom = true;
      }
      const newId = generateId();
      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: "widget",
          x: c.x - preset.w / 2,
          y: c.y - preset.h / 2,
          w: preset.w,
          h: preset.h,
          widgetKey,
          widgetVariant: style.variant,
          widgetSkin: style.skin,
          widgetDisplay: style.display,
          title: opts?.title,
          widgetConfig: Object.keys(widgetConfig).length ? widgetConfig : undefined,
          zIndex: newZ,
        },
      ]);
      setSelected(new Set([newId]));
      setEditMode(true);
      setLibraryOpen(false);
    },
    [maxZ, viewCenter, setEditMode, setLibraryOpen],
  );

  const addImageNode = useCallback(
    (payload: ImageInsertPayload) => {
      const newZ = maxZ + 1;
      setMaxZ(newZ);
      const c = viewCenter();
      setNodes((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "image",
          x: c.x - payload.w / 2,
          y: c.y - payload.h / 2,
          w: payload.w,
          h: payload.h,
          imageUrl: payload.imageUrl,
          zIndex: newZ,
        },
      ]);
      setEditMode(true);
    },
    [maxZ, viewCenter],
  );

  const openWidgetComposer = useCallback((entry: WidgetRegistryEntry) => {
    setLibraryOpen(false);
    setComposerState({ kind: "widget", entry });
  }, []);

  const openImageComposer = useCallback(() => {
    setLibraryOpen(false);
    setComposerState({ kind: "image" });
  }, []);

  const insertFromComposer = useCallback(
    (payload: WidgetInsertPayload) => {
      addWidget(payload.widgetKey, payload.variant, payload.skin, payload.display, {
        title: payload.title,
        textSizePx: payload.textSizePx,
        textScale: payload.textScale,
      });
      setComposerState(null);
    },
    [addWidget],
  );

  const insertImageFromComposer = useCallback(
    (payload: ImageInsertPayload) => {
      addImageNode(payload);
      setComposerState(null);
    },
    [addImageNode],
  );

  const resetDashboardLayout = useCallback(() => {
    const fresh = createDefaultDashboardNodes();
    setNodes(fresh);
    setMaxZ(0);
    setSelected(new Set());
    setEditMode(true);
  }, []);

  const applyStarterLayout = useCallback(() => {
    const starter = normalizeNodes(createStarterDashboardNodes());
    setNodes((prev) => {
      // Keep any non-widget nodes (images, notes, backdrops) already on the board.
      const next = [...prev.filter((n) => n.type !== "widget"), ...starter];
      setMaxZ(Math.max(...next.map((n) => n.zIndex), 0));
      return next;
    });
    setSelected(new Set());
    setPan({ x: 0, y: 0 });
    setZoom(1);
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
    zoomAnimRef.current?.cancel();
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
    zoomAnimRef.current = runRafAnimation(
      220,
      springOut,
      (t) => {
        const z = startZoom + (clampedTarget - startZoom) * t;
        const ratio = z / startZoom;
        applyLayerTransform(
          { x: cx - ratio * (cx - startPan.x), y: cy - ratio * (cy - startPan.y) },
          z,
        );
      },
      commitChromeSync,
    );
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
    }, 240);
  }, [nodes, animateZoom, applyLayerTransform, commitChromeSync]);

  // Keyboard: delete selection; Esc clears customize (Figma-style)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inField =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);
      if (e.key === "Escape") {
        if (inField) return;
        if (composerState) {
          setComposerState(null);
          return;
        }
        handleBackgroundTap();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        if (inField) return;
        setNodes((prev) => prev.filter((n) => !selected.has(n.id)));
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, composerState, handleBackgroundTap]);

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
      className={`canvas-dashboard canvas-dashboard--fixed-chrome${editMode ? " canvas-dashboard--edit-mode" : ""}${editMode && libraryOpen ? " canvas-dashboard--library-open" : ""}`}
      data-ui-density={ui.density}
      data-surface-tone={ui.surfaceTone}
      ref={containerRef}
    >
      <WidgetLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        docked={editMode}
        onPick={openWidgetComposer}
        onPickImage={openImageComposer}
      />
      {renderWidget ? (
        <WidgetComposerDialog
          open={composerState !== null}
          onOpenChange={(open) => !open && setComposerState(null)}
          state={composerState}
          boardTypography={{ textSizePx: ui.textSizePx, textScale: ui.textScale }}
          renderPreview={renderWidget}
          onInsertWidget={insertFromComposer}
          onInsertImage={insertImageFromComposer}
        />
      ) : null}
      <div
        className={`canvas-chrome-stack${editMode ? " canvas-chrome-stack--edit-mode" : ""}${selectedNode ? " canvas-chrome-stack--has-selection" : ""}`}
        ref={chromeDockRef}
      >
        <div className={`canvas-chrome-dock${selectedNode ? " canvas-chrome-dock--has-selection" : ""}`}>
        <div className={`canvas-unified-toolbar${editMode ? " canvas-unified-toolbar--expanded" : ""}`}>
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
              onOpenWidgetLibrary={enterCustomizeMode}
              onResetLayout={resetDashboardLayout}
              widgetCount={widgetNodeCount}
              onAddWidget={addWidget}
              onAddImage={addImage}
              onStageImage={(url) => setComposerState({ kind: "image", imageUrl: url })}
              onOpenImageComposer={openImageComposer}
              onAddNote={addNote}
              onAddCustom={addCustom}
              onAddEmbed={addEmbed}
              onAddBackdrop={addBackdrop}
              background={background}
              onBackgroundChange={onBackgroundChange}
            />
            {selectedNode ? (
              <>
                <span className="canvas-unified-toolbar__divider" aria-hidden />
                <CanvasWidgetInspectorInline
                  node={selectedNode}
                  boardTypography={{ textSizePx: ui.textSizePx, textScale: ui.textScale }}
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
                  onToggleLock={() => toggleNodeLock(selectedNode.id)}
                  onRemove={() => removeNode(selectedNode.id)}
                  onClearSelection={() => setSelected(new Set())}
                />
              </>
            ) : null}
            {renderWidget ? <DashboardTypographyToolbar /> : null}
          </div>
          {editMode ? (
            <div className="canvas-unified-toolbar__row canvas-unified-toolbar__row--secondary">
              <DashboardCustomizeStrip />
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`canvas-viewport${viewPrefs.showGrid ? "" : " canvas-viewport--no-grid"}${viewPrefs.gridStyle === "lines" ? " canvas-viewport--grid-lines" : ""}${entranceChoreo ? " canvas-viewport--choreo" : ""}`}
        onWheel={onWheel}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        style={
          {
            ...canvasBackgroundCss(background),
            ...(ambientPalette ? { "--canvas-bg-fill": ambientPalette.base } : {}),
          } as React.CSSProperties
        }
      >
        {ambientPalette && (
          <div
            className="canvas-ambient"
            aria-hidden
            style={
              {
                "--ambient-c1": ambientPalette.c1,
                "--ambient-c2": ambientPalette.c2,
                "--ambient-c3": ambientPalette.c3,
              } as React.CSSProperties
            }
          >
            <span className="canvas-ambient__blob canvas-ambient__blob--1" />
            <span className="canvas-ambient__blob canvas-ambient__blob--2" />
            <span className="canvas-ambient__blob canvas-ambient__blob--3" />
          </div>
        )}
        {showEmptyOnboarding && (
          <DashboardEmptyState
            onAddWidget={enterCustomizeMode}
            onUseStarter={applyStarterLayout}
          />
        )}
        <div ref={layerRef} className="canvas-layer">
          {[...nodes]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((node) => (
            <MemoCanvasItem
              key={node.id}
              node={node}
              widgets={widgets}
              renderWidget={renderWidget}
              editMode={editMode}
              isSelected={selected.has(node.id)}
              onSelect={() => selectCanvasItem(node.id)}
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

        <div className="canvas-guides-layer" aria-hidden>
          {Array.from({ length: MAX_GUIDES }).map((_, i) => (
            <div
              key={`guide-${i}`}
              ref={(el) => {
                guideElsRef.current[i] = el;
              }}
              className="canvas-guide"
              style={{ display: "none" }}
            />
          ))}
        </div>

        <div ref={selBoxElRef} className="canvas-sel-box" style={{ display: "none" }} />
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
        {editMode
          ? "Widget controls in toolbar · Empty canvas to deselect · Esc to finish"
          : "Click a widget · customize in toolbar · + Add to insert · Ctrl/Alt+scroll to zoom"}
      </div>
    </div>
  );
}
