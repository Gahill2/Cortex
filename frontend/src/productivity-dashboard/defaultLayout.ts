import type { GridWidgetInstance } from "./types";

/** Default bento layout — 12-column grid. */
export function createDefaultLayout(): GridWidgetInstance[] {
  const t = Date.now();
  const id = (n: number) => `w_${t}_${n}`;
  return [
    { id: id(1), widgetId: "today-overview", col: 0, row: 0, colSpan: 6, rowSpan: 2, settings: { density: "default" } },
    { id: id(2), widgetId: "quick-tasks", col: 6, row: 0, colSpan: 3, rowSpan: 3, settings: { density: "default" } },
    { id: id(3), widgetId: "daily-agenda", col: 9, row: 0, colSpan: 3, rowSpan: 3, settings: { density: "default" } },
    { id: id(4), widgetId: "mini-calendar", col: 0, row: 2, colSpan: 3, rowSpan: 2, settings: { density: "compact" } },
    { id: id(5), widgetId: "goals-progress", col: 3, row: 2, colSpan: 3, rowSpan: 2, settings: { density: "default" } },
    { id: id(6), widgetId: "habits", col: 0, row: 4, colSpan: 4, rowSpan: 2, settings: { density: "default" } },
    { id: id(7), widgetId: "upcoming", col: 4, row: 4, colSpan: 3, rowSpan: 2, settings: { density: "compact" } },
    { id: id(8), widgetId: "inbox-capture", col: 7, row: 4, colSpan: 2, rowSpan: 1, settings: { density: "compact" } },
    { id: id(9), widgetId: "focus-block", col: 9, row: 4, colSpan: 3, rowSpan: 2, settings: { density: "default" } },
    { id: id(10), widgetId: "notes", col: 7, row: 5, colSpan: 2, rowSpan: 1, settings: { density: "compact" } },
    { id: id(11), widgetId: "email-preview", col: 0, row: 6, colSpan: 4, rowSpan: 2, settings: { density: "default" } },
    { id: id(12), widgetId: "automations", col: 4, row: 6, colSpan: 3, rowSpan: 2, settings: { density: "default" } },
    { id: id(13), widgetId: "music", col: 7, row: 6, colSpan: 2, rowSpan: 2, settings: { density: "default" } },
    { id: id(14), widgetId: "system-status", col: 9, row: 6, colSpan: 3, rowSpan: 1, settings: { density: "compact" } },
  ];
}
