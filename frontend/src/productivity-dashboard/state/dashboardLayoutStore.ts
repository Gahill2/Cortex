import { create } from "zustand";
import type { DashboardLayoutState, GridWidgetInstance, WidgetSettings } from "../types";
import { createDefaultLayout } from "../defaultLayout";
import { localLayoutPersistence } from "../persistence/layoutStorage";
import { getWidgetEntry } from "../registry";

function persist(widgets: GridWidgetInstance[]) {
  const state: DashboardLayoutState = {
    version: 1,
    widgets,
    updatedAt: new Date().toISOString(),
  };
  localLayoutPersistence.save(state);
}

function newInstance(widgetId: string): GridWidgetInstance | null {
  const entry = getWidgetEntry(widgetId);
  if (!entry) return null;
  const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    widgetId,
    col: 0,
    row: 0,
    colSpan: entry.sizes.defaultCol,
    rowSpan: entry.sizes.defaultRow,
    settings: { ...entry.defaultSettings },
  };
}

interface DashboardLayoutStore {
  widgets: GridWidgetInstance[];
  editMode: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setEditMode: (v: boolean) => void;
  resetLayout: () => void;
  addWidget: (widgetId: string) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<GridWidgetInstance>) => void;
  updateSettings: (id: string, patch: WidgetSettings) => void;
  moveWidget: (id: string, col: number, row: number) => void;
  resizeWidget: (id: string, colSpan: number, rowSpan: number) => void;
  reorderWidgets: (orderedIds: string[]) => void;
}

export const useDashboardLayoutStore = create<DashboardLayoutStore>((set, get) => ({
  widgets: [],
  editMode: false,
  hydrated: false,

  hydrate() {
    if (get().hydrated) return;
    const saved = localLayoutPersistence.load();
    const widgets = saved?.widgets?.length ? saved.widgets : createDefaultLayout();
    set({ widgets, hydrated: true });
  },

  setEditMode(editMode) {
    set({ editMode });
  },

  resetLayout() {
    const widgets = createDefaultLayout();
    persist(widgets);
    set({ widgets });
  },

  addWidget(widgetId) {
    const inst = newInstance(widgetId);
    if (!inst) return;
    const widgets = [...get().widgets, inst];
    persist(widgets);
    set({ widgets });
  },

  removeWidget(id) {
    const widgets = get().widgets.filter((w) => w.id !== id);
    persist(widgets);
    set({ widgets });
  },

  updateWidget(id, patch) {
    const current = get().widgets.find((w) => w.id === id);
    if (!current) return;

    const next = { ...current, ...patch };
    const layoutKeys = ["col", "row", "colSpan", "rowSpan"] as const;
    const layoutUnchanged = layoutKeys.every(
      (key) => !(key in patch) || current[key] === next[key],
    );
    const settingsUnchanged =
      !("settings" in patch) ||
      Object.keys({ ...current.settings, ...patch.settings! }).every(
        (key) => current.settings[key] === next.settings[key],
      );
    const otherKeys = (Object.keys(patch) as (keyof GridWidgetInstance)[]).filter(
      (key) => key !== "settings" && !layoutKeys.includes(key as (typeof layoutKeys)[number]),
    );
    const otherUnchanged = otherKeys.every((key) => current[key] === next[key]);

    if (layoutUnchanged && settingsUnchanged && otherUnchanged) return;

    const widgets = get().widgets.map((w) => (w.id === id ? next : w));
    persist(widgets);
    set({ widgets });
  },

  updateSettings(id, patch) {
    const current = get().widgets.find((w) => w.id === id);
    if (!current) return;

    const nextSettings = { ...current.settings, ...patch };
    const unchanged = Object.keys(patch).every((key) => current.settings[key] === patch[key]);
    if (unchanged) return;

    const widgets = get().widgets.map((w) =>
      w.id === id ? { ...w, settings: nextSettings } : w,
    );
    persist(widgets);
    set({ widgets });
  },

  moveWidget(id, col, row) {
    const w = get().widgets.find((x) => x.id === id);
    if (!w) return;
    const nextCol = Math.max(0, col);
    const nextRow = Math.max(0, row);
    if (w.col === nextCol && w.row === nextRow) return;
    get().updateWidget(id, { col: nextCol, row: nextRow });
  },

  resizeWidget(id, colSpan, rowSpan) {
    const w = get().widgets.find((x) => x.id === id);
    if (!w) return;
    const entry = getWidgetEntry(w.widgetId);
    const minC = entry?.sizes.minCol ?? 2;
    const maxC = entry?.sizes.maxCol ?? 12;
    const minR = entry?.sizes.minRow ?? 1;
    const maxR = entry?.sizes.maxRow ?? 6;
    const nextColSpan = Math.min(maxC, Math.max(minC, colSpan));
    const nextRowSpan = Math.min(maxR, Math.max(minR, rowSpan));
    if (w.colSpan === nextColSpan && w.rowSpan === nextRowSpan) return;
    get().updateWidget(id, { colSpan: nextColSpan, rowSpan: nextRowSpan });
  },

  reorderWidgets(orderedIds) {
    const map = new Map(get().widgets.map((w) => [w.id, w]));
    const widgets = orderedIds.map((id) => map.get(id)).filter(Boolean) as GridWidgetInstance[];
    if (widgets.length !== get().widgets.length) return;
    persist(widgets);
    set({ widgets });
  },
}));
