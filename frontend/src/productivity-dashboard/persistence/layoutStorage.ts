import type { DashboardLayoutState } from "../types";

const STORAGE_KEY = "cortex-productivity-layout-v1";

export interface LayoutPersistence {
  load(): DashboardLayoutState | null;
  save(state: DashboardLayoutState): void;
  clear(): void;
}

export const localLayoutPersistence: LayoutPersistence = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DashboardLayoutState;
      if (parsed?.version !== 1 || !Array.isArray(parsed.widgets)) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
