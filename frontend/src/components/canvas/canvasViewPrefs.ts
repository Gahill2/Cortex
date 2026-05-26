import { useCallback, useEffect, useState } from "react";

export type GridStyle = "dots" | "lines";

export interface CanvasViewPrefs {
  showGrid: boolean;
  snapToGrid: boolean;
  gridStyle: GridStyle;
  gridSize: 8 | 16 | 24;
}

const STORAGE_KEY = "cortex-canvas-view-prefs";

export const DEFAULT_CANVAS_VIEW_PREFS: CanvasViewPrefs = {
  showGrid: true,
  snapToGrid: true,
  gridStyle: "dots",
  gridSize: 24,
};

function loadPrefs(): CanvasViewPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CANVAS_VIEW_PREFS;
    const parsed = JSON.parse(raw) as Partial<CanvasViewPrefs>;
    return {
      showGrid: parsed.showGrid ?? DEFAULT_CANVAS_VIEW_PREFS.showGrid,
      snapToGrid: parsed.snapToGrid ?? DEFAULT_CANVAS_VIEW_PREFS.snapToGrid,
      gridStyle: parsed.gridStyle === "lines" ? "lines" : "dots",
      gridSize: parsed.gridSize === 8 || parsed.gridSize === 16 ? parsed.gridSize : 24,
    };
  } catch {
    return DEFAULT_CANVAS_VIEW_PREFS;
  }
}

function savePrefs(prefs: CanvasViewPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function useCanvasViewPrefs() {
  const [prefs, setPrefs] = useState<CanvasViewPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const patch = useCallback((next: Partial<CanvasViewPrefs>) => {
    setPrefs((p) => ({ ...p, ...next }));
  }, []);

  return { prefs, patch, setPrefs };
}
