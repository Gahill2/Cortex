import type { CanvasNode } from "../components/canvas/CanvasDashboard";
import { buildWidgetRenderStyle } from "../components/canvas/widgetRenderStyle";
import { getVariantPreset } from "../components/canvas/widgetVariants";
import { getRegistryEntry } from "../dashboard/widgetRegistry";
import type { GridWidgetInstance } from "../productivity-dashboard/types";
import { GRID_COLS, GRID_GAP, GRID_ROW_HEIGHT } from "../productivity-dashboard/types";
import { localLayoutPersistence } from "../productivity-dashboard/persistence/layoutStorage";

const PRODUCTIVITY_STORAGE_KEY = "cortex-productivity-layout-v1";
const MIGRATION_FLAG_KEY = "cortex-productivity-layout-migrated-v1";

/** Map productivity widget ids → canvas widget keys */
const WIDGET_ID_TO_CANVAS_KEY: Record<string, string> = {
  "today-overview": "today",
  "quick-tasks": "tasks",
  "daily-agenda": "calendar",
  "mini-calendar": "calendar",
  upcoming: "calendar",
  "goals-progress": "goals",
  habits: "habits",
  "habit-heatmap": "habits",
  "inbox-capture": "notes",
  "focus-block": "pomodoro",
  notes: "notes",
  "email-preview": "mail",
  automations: "automations",
  music: "spotify",
  "system-status": "system",
};

/** Reference width for 12-column productivity grid → canvas pixels */
const REF_GRID_WIDTH = 1200;
const ORIGIN_X = 48;
const ORIGIN_Y = 48;

function colWidthPx(): number {
  return (REF_GRID_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
}

function gridInstanceToCanvasNode(inst: GridWidgetInstance, zIndex: number): CanvasNode | null {
  const widgetKey = WIDGET_ID_TO_CANVAS_KEY[inst.widgetId];
  if (!widgetKey) return null;
  const entry = getRegistryEntry(widgetKey);
  if (!entry) return null;

  const cw = colWidthPx();
  const x = ORIGIN_X + inst.col * (cw + GRID_GAP);
  const y = ORIGIN_Y + inst.row * (GRID_ROW_HEIGHT + GRID_GAP);
  const w = inst.colSpan * cw + (inst.colSpan - 1) * GRID_GAP;
  const h = inst.rowSpan * GRID_ROW_HEIGHT + (inst.rowSpan - 1) * GRID_GAP;

  const style = buildWidgetRenderStyle(
    widgetKey,
    entry.defaultVariant,
    entry.defaultSkin,
    entry.defaultDisplay,
  );
  const preset = getVariantPreset(widgetKey, style.variant);
  const title =
    typeof inst.settings?.title === "string" ? inst.settings.title : undefined;

  return {
    id: `m_${inst.id}`,
    type: "widget",
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(preset.w, Math.round(w)),
    h: Math.max(preset.h, Math.round(h)),
    widgetKey,
    widgetVariant: style.variant,
    widgetSkin: style.skin,
    widgetDisplay: style.display,
    title,
    widgetConfig: { ...inst.settings },
    zIndex,
  };
}

/** One-time: productivity bento layout → canvas nodes (snap-friendly positions). */
export function tryMigrateProductivityLayoutToCanvas(): CanvasNode[] | null {
  try {
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return null;
    const saved = localLayoutPersistence.load();
    const widgets = saved?.widgets?.length ? saved.widgets : null;
    if (!widgets?.length) return null;

    const nodes: CanvasNode[] = [];
    let z = 1;
    const seenKeys = new Set<string>();
    for (const inst of widgets) {
      const key = WIDGET_ID_TO_CANVAS_KEY[inst.widgetId];
      if (!key || seenKeys.has(`${key}:${inst.col}:${inst.row}`)) continue;
      const node = gridInstanceToCanvasNode(inst, z++);
      if (node) {
        nodes.push(node);
        seenKeys.add(`${key}:${inst.col}:${inst.row}`);
      }
    }
    if (!nodes.length) return null;

    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    return nodes;
  } catch {
    return null;
  }
}

export function clearProductivityLayoutAfterMigration(): void {
  try {
    localStorage.removeItem(PRODUCTIVITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
