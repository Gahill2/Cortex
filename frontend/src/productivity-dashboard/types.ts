/** Grid productivity dashboard — layout & registry types (backend-ready persistence). */

export type WidgetCategory =
  | "today"
  | "calendar"
  | "tasks"
  | "goals"
  | "habits"
  | "notes"
  | "email"
  | "music"
  | "automations"
  | "analytics"
  | "system";

export type WidgetDensity = "compact" | "default" | "expanded";

export type DashboardViewMode = "dashboard" | "calendar" | "tasks" | "goals" | "habits";

/** Home shell: grid widgets vs freeform canvas board */
export type HomeLayoutMode = "widgets" | "board";

export interface WidgetSettings {
  title?: string;
  accentColor?: string;
  density?: WidgetDensity;
  dataSource?: string;
  [key: string]: unknown;
}

export interface GridWidgetInstance {
  id: string;
  widgetId: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  settings: WidgetSettings;
}

export interface DashboardLayoutState {
  version: 1;
  widgets: GridWidgetInstance[];
  updatedAt: string;
}

export type WidgetConfigFieldType = "text" | "toggle" | "color" | "select";

export interface WidgetConfigField {
  key: string;
  label: string;
  type: WidgetConfigFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface WidgetSizeConstraints {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
  defaultCol: number;
  defaultRow: number;
}

export interface WidgetRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  icon: string;
  previewGradient?: string;
  sizes: WidgetSizeConstraints;
  defaultSettings: WidgetSettings;
  configFields: WidgetConfigField[];
}

export interface WidgetRenderProps {
  density: WidgetDensity;
  settings: WidgetSettings;
  compact: boolean;
  onNavigate?: (tab: import("../tab").Tab) => void;
}

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  today: "Today",
  calendar: "Calendar",
  tasks: "Tasks",
  goals: "Goals",
  habits: "Habits",
  notes: "Notes",
  email: "Email",
  music: "Music",
  automations: "Automations",
  analytics: "Analytics",
  system: "System",
};

export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 72;
export const GRID_GAP = 16;
