import type { CanvasNode } from "../components/canvas/CanvasDashboard";
import { getVariantPreset } from "../components/canvas/widgetVariants";
import type { WidgetSizeVariant } from "../components/canvas/widgetVariants";

/** Empty board — add widgets via the composer (library → configure → insert). */
export function createDefaultDashboardNodes(): CanvasNode[] {
  return [];
}

const ROW_GAP = 20;
const COL_GAP = 24;
const ORIGIN = 32;

type StarterColumn = {
  widgets: { key: string; variant: WidgetSizeVariant }[];
};

/**
 * Curated three-column starter board. Sizes and positions come from each widget's
 * registry preset so content is not squeezed into arbitrary 360px boxes.
 */
const STARTER_COLUMNS: StarterColumn[] = [
  {
    widgets: [
      { key: "today", variant: "medium" },
      { key: "tasks", variant: "medium" },
      { key: "quote", variant: "small" },
    ],
  },
  {
    widgets: [
      { key: "at-a-glance", variant: "medium" },
      { key: "calendar", variant: "medium" },
    ],
  },
  {
    widgets: [
      { key: "weather", variant: "small" },
      { key: "mail", variant: "medium" },
      { key: "spotify", variant: "small" },
    ],
  },
];

function layoutStarterColumns(): CanvasNode[] {
  const nodes: CanvasNode[] = [];
  let x = ORIGIN;
  let z = 1;

  for (const column of STARTER_COLUMNS) {
    const colWidth = Math.max(
      ...column.widgets.map((w) => getVariantPreset(w.key, w.variant).w),
    );
    let y = ORIGIN;

    for (const spec of column.widgets) {
      const preset = getVariantPreset(spec.key, spec.variant);
      nodes.push({
        id: `starter-${spec.key}`,
        type: "widget",
        x,
        y,
        w: preset.w,
        h: preset.h,
        widgetKey: spec.key,
        widgetVariant: spec.variant,
        zIndex: z++,
      });
      y += preset.h + ROW_GAP;
    }

    x += colWidth + COL_GAP;
  }

  return nodes;
}

export function createStarterDashboardNodes(): CanvasNode[] {
  return layoutStarterColumns();
}

/** Re-align saved starter widgets to the current canonical layout (fixes older bad sizes). */
export function reconcileStarterLayout(nodes: CanvasNode[]): CanvasNode[] {
  const canonical = new Map(
    createStarterDashboardNodes().map((n) => [n.id, n] as const),
  );
  if (!nodes.some((n) => n.type === "widget" && canonical.has(n.id))) {
    return nodes;
  }

  return nodes.map((n) => {
    const canon = canonical.get(n.id);
    if (!canon || n.type !== "widget") return n;
    return {
      ...n,
      x: canon.x,
      y: canon.y,
      w: canon.w,
      h: canon.h,
      widgetVariant: canon.widgetVariant,
      widgetKey: canon.widgetKey,
    };
  });
}
