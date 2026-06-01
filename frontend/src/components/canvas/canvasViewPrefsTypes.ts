export type GridStyle = "dots" | "lines";

export interface CanvasViewPrefs {
  showGrid: boolean;
  snapToGrid: boolean;
  gridStyle: GridStyle;
  gridSize: 8 | 16 | 24;
}

export const DEFAULT_CANVAS_VIEW_PREFS: CanvasViewPrefs = {
  showGrid: true,
  snapToGrid: true,
  gridStyle: "dots",
  gridSize: 24,
};
