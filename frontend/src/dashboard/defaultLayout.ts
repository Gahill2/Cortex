import type { CanvasNode } from "../components/canvas/CanvasDashboard";

/** Empty board — add widgets via the composer (library → configure → insert). */
export function createDefaultDashboardNodes(): CanvasNode[] {
  return [];
}

const COL_W = 360;
const GAP = 16;
const ORIGIN = 24;

const col = (i: number) => ORIGIN + i * (COL_W + GAP);

type StarterSpec = {
  key: string;
  variant: "small" | "medium" | "large";
  x: number;
  y: number;
  h: number;
};

/**
 * Curated three-column starter board for first-run users. Sizes stay close to
 * the registry presets; skin/display are filled in by normalizeNodes from
 * each widget's registry defaults.
 */
const STARTER_SPECS: StarterSpec[] = [
  // Column 1 — your day
  { key: "today", variant: "medium", x: col(0), y: 24, h: 200 },
  { key: "tasks", variant: "medium", x: col(0), y: 240, h: 320 },
  { key: "quote", variant: "small", x: col(0), y: 576, h: 140 },
  // Column 2 — overview
  { key: "at-a-glance", variant: "medium", x: col(1), y: 24, h: 360 },
  { key: "calendar", variant: "medium", x: col(1), y: 400, h: 300 },
  // Column 3 — signals
  { key: "weather", variant: "small", x: col(2), y: 24, h: 180 },
  { key: "mail", variant: "medium", x: col(2), y: 220, h: 300 },
  { key: "spotify", variant: "small", x: col(2), y: 536, h: 180 },
];

export function createStarterDashboardNodes(): CanvasNode[] {
  return STARTER_SPECS.map((spec, index) => ({
    id: `starter-${spec.key}`,
    type: "widget" as const,
    x: spec.x,
    y: spec.y,
    w: COL_W,
    h: spec.h,
    widgetKey: spec.key,
    widgetVariant: spec.variant,
    zIndex: index + 1,
  }));
}
