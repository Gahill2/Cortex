/** Per-widget layout/aesthetic (like clock analog vs digital). */
export interface WidgetDisplayOption {
  id: string;
  label: string;
  shortLabel: string;
  description?: string;
}

const clock: WidgetDisplayOption[] = [
  { id: "list", label: "World list", shortLabel: "List", description: "Stacked cities with times" },
  { id: "digital-hero", label: "Digital hero", shortLabel: "Digital", description: "Large centered clock" },
  { id: "analog", label: "Analog face", shortLabel: "Analog", description: "Classic dial + label" },
  { id: "zones-grid", label: "Zone grid", shortLabel: "Grid", description: "2×2 city cards" },
];

const weather: WidgetDisplayOption[] = [
  { id: "standard", label: "Standard", shortLabel: "Std", description: "Icon, temp, and forecast row" },
  { id: "hero", label: "Hero", shortLabel: "Hero", description: "Big temperature up front" },
  { id: "minimal", label: "Minimal", shortLabel: "Min", description: "Current conditions only" },
  { id: "gradient", label: "Gradient card", shortLabel: "Card", description: "Full-bleed color card" },
];

const spotify: WidgetDisplayOption[] = [
  { id: "standard", label: "Player", shortLabel: "Play", description: "Art + track + controls" },
  { id: "art", label: "Album focus", shortLabel: "Art", description: "Large cover, centered" },
  { id: "compact", label: "Now playing bar", shortLabel: "Bar", description: "Thin bar layout" },
];

const mail: WidgetDisplayOption[] = [
  { id: "standard", label: "Inbox", shortLabel: "Inbox", description: "Avatar rows with preview" },
  { id: "notion-list", label: "Notion list", shortLabel: "List", description: "Quiet text-only rows" },
];

const tasks: WidgetDisplayOption[] = [
  { id: "standard", label: "Checklist", shortLabel: "List", description: "Compact task rows" },
  { id: "cards", label: "Card stack", shortLabel: "Cards", description: "Separated task cards" },
];

const pomodoro: WidgetDisplayOption[] = [
  { id: "ring", label: "Focus ring", shortLabel: "Ring", description: "Circular progress ring" },
  { id: "digital", label: "Digital timer", shortLabel: "Digits", description: "Large numeric clock" },
  { id: "minimal", label: "Minimal", shortLabel: "Min", description: "Timer + start only" },
];

const habits: WidgetDisplayOption[] = [
  { id: "grid", label: "Week grid", shortLabel: "Grid", description: "7-day checkbox grid" },
  { id: "list", label: "Habit list", shortLabel: "List", description: "Stacked habit rows" },
];

const quote: WidgetDisplayOption[] = [
  { id: "card", label: "Quote card", shortLabel: "Card", description: "Framed quote block" },
  { id: "minimal", label: "Type only", shortLabel: "Type", description: "Centered typography" },
];

const DEFAULT: WidgetDisplayOption[] = [
  { id: "standard", label: "Standard", shortLabel: "Std" },
];

export const WIDGET_DISPLAY_BY_KEY: Record<string, WidgetDisplayOption[]> = {
  clock,
  weather,
  spotify,
  mail,
  tasks,
  pomodoro,
  habits,
  quote,
  ai: DEFAULT,
};

export function getWidgetDisplayOptions(widgetKey: string): WidgetDisplayOption[] {
  return WIDGET_DISPLAY_BY_KEY[widgetKey] ?? DEFAULT;
}

export function normalizeWidgetDisplay(widgetKey: string, raw: string | undefined): string {
  const options = getWidgetDisplayOptions(widgetKey);
  const fallback = options[0]?.id ?? "standard";
  if (raw && options.some((o) => o.id === raw)) return raw;
  return fallback;
}
