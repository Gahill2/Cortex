import { useCallback, useEffect, useState } from "react";
import { usePreferencesOptional } from "../../context/PreferencesContext";
import { DEFAULT_CANVAS_VIEW_PREFS, type CanvasViewPrefs, type GridStyle } from "./canvasViewPrefsTypes";

export type { CanvasViewPrefs, GridStyle } from "./canvasViewPrefsTypes";
export { DEFAULT_CANVAS_VIEW_PREFS } from "./canvasViewPrefsTypes";

const STORAGE_KEY = "cortex-canvas-view-prefs";

function loadPrefsFromStorage(): CanvasViewPrefs {
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

function savePrefsToStorage(prefs: CanvasViewPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function useCanvasViewPrefs() {
  const prefsCtx = usePreferencesOptional();
  const ready = prefsCtx?.ready ?? false;
  const patch = prefsCtx?.patch;
  const serverPrefs = prefsCtx?.settings.extraJson?.canvasViewPrefs;

  const [prefs, setPrefs] = useState<CanvasViewPrefs>(() =>
    ready && serverPrefs ? serverPrefs : loadPrefsFromStorage(),
  );

  useEffect(() => {
    if (!ready) return;
    if (serverPrefs) {
      setPrefs(serverPrefs);
      savePrefsToStorage(serverPrefs);
    }
  }, [ready, serverPrefs]);

  const patchPrefs = useCallback(
    (next: Partial<CanvasViewPrefs>) => {
      setPrefs((prev) => {
        const merged = { ...prev, ...next };
        savePrefsToStorage(merged);
        patch?.({ extraJson: { canvasViewPrefs: merged } });
        return merged;
      });
    },
    [patch],
  );

  return { prefs, patch: patchPrefs, setPrefs };
}
