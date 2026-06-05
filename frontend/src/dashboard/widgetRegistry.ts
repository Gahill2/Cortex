import type { WidgetRegistryEntry, WidgetVariantPreset } from "./types";

export type { WidgetRegistryEntry } from "./types";

const v = (
  id: WidgetRegistryEntry["defaultVariant"],
  label: string,
  w: number,
  h: number,
  layout: WidgetVariantPreset["layout"],
): WidgetVariantPreset => ({
  id,
  label,
  shortLabel: id === "small" ? "S" : id === "medium" ? "M" : "L",
  w,
  h,
  layout,
});

const STANDARD: WidgetVariantPreset[] = [
  v("small", "Small", 260, 180, "compact"),
  v("medium", "Medium", 380, 260, "default"),
  v("large", "Large", 480, 340, "expanded"),
];

const TALL: WidgetVariantPreset[] = [
  v("small", "Small", 260, 200, "compact"),
  v("medium", "Medium", 380, 300, "default"),
  v("large", "Large", 520, 400, "expanded"),
];

const WIDE: WidgetVariantPreset[] = [
  v("small", "Small", 300, 180, "compact"),
  v("medium", "Medium", 420, 280, "default"),
  v("large", "Large", 560, 360, "expanded"),
];

const COMPACT: WidgetVariantPreset[] = [
  v("small", "Small", 280, 160, "compact"),
  v("medium", "Medium", 360, 200, "default"),
  v("large", "Large", 440, 240, "expanded"),
];

export const WIDGET_REGISTRY: WidgetRegistryEntry[] = [
  {
    key: "today",
    label: "Today",
    icon: "☀️",
    category: "productivity",
    description: "Date, greeting, and a quick snapshot of your day.",
    variants: COMPACT,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #5b8dff 0%, #7c9dff 100%)",
    configFields: [
      { key: "title", label: "Title", type: "text", placeholder: "Today" },
      { key: "accentColor", label: "Accent", type: "color" },
    ],
  },
  {
    key: "at-a-glance",
    label: "At a glance",
    icon: "◈",
    category: "productivity",
    description: "Tasks, calendar, and homelab in one board.",
    variants: [
      v("small", "Small", 320, 220, "compact"),
      v("medium", "Medium", 440, 360, "default"),
      v("large", "Large", 520, 440, "expanded"),
    ],
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
  },
  {
    key: "media",
    label: "Media stack",
    icon: "🎬",
    category: "system",
    description: "Jellyfin, *arr, and download clients at a glance.",
    variants: COMPACT,
    defaultVariant: "medium",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "✓",
    category: "productivity",
    description: "Upcoming tasks with clean checkboxes and progress.",
    variants: TALL,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #3be8ad 0%, #2dd4bf 100%)",
    configFields: [{ key: "title", label: "Title", type: "text" }],
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: "📅",
    category: "calendar",
    description: "Upcoming events and due dates at a glance.",
    variants: TALL,
    defaultVariant: "medium",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #f5a623 0%, #fb923c 100%)",
  },
  {
    key: "mail",
    label: "Mail",
    icon: "✉",
    category: "email",
    description: "Priority inbox preview and quick open.",
    variants: TALL,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  },
  {
    key: "spotify",
    label: "Music",
    icon: "♫",
    category: "music",
    description: "Now playing and playlist shortcuts.",
    variants: STANDARD,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #1db954 0%, #22c55e 100%)",
  },
  {
    key: "goals",
    label: "Goals",
    icon: "🎯",
    category: "productivity",
    description: "Active goals and progress at a glance.",
    variants: TALL,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
  },
  {
    key: "notes",
    label: "Notes",
    icon: "📝",
    category: "productivity",
    description: "Pinned note or quick scratch pad on your board.",
    variants: STANDARD,
    defaultVariant: "medium",
    defaultSkin: "notion",
    previewGradient: "linear-gradient(135deg, #a855f7 0%, #c084fc 100%)",
    configFields: [{ key: "title", label: "Title", type: "text" }],
  },
  {
    key: "automations",
    label: "Automations",
    icon: "⚡",
    category: "automations",
    description: "MCP tools and active workflows.",
    variants: COMPACT,
    defaultVariant: "medium",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #06b6d4 0%, #38bdf8 100%)",
  },
  {
    key: "system",
    label: "System",
    icon: "◉",
    category: "system",
    description: "API and app health at a glance.",
    variants: COMPACT,
    defaultVariant: "small",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
  },
  {
    key: "weather",
    label: "Weather",
    icon: "🌤",
    category: "analytics",
    description: "Current conditions and forecast.",
    variants: STANDARD,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
  },
  {
    key: "ai",
    label: "AI",
    icon: "✦",
    category: "automations",
    description: "Jump into Cortex AI chat.",
    variants: WIDE,
    defaultVariant: "medium",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #5b8dff 0%, #a855f7 100%)",
  },
  {
    key: "pomodoro",
    label: "Focus",
    icon: "⏱",
    category: "productivity",
    description: "Pomodoro timer for deep work.",
    variants: STANDARD,
    defaultVariant: "medium",
    defaultSkin: "ios",
    previewGradient: "linear-gradient(135deg, #ff5f5f 0%, #f97316 100%)",
  },
  {
    key: "clock",
    label: "World Clock",
    icon: "🕐",
    category: "calendar",
    description: "Time zones you care about.",
    variants: STANDARD,
    defaultVariant: "medium",
    defaultSkin: "ios",
  },
  {
    key: "habits",
    label: "Habits",
    icon: "📊",
    category: "analytics",
    description: "Daily habit streaks.",
    variants: TALL,
    defaultVariant: "medium",
    defaultSkin: "notion",
  },
  {
    key: "homelab",
    label: "Homelab",
    icon: "🖥",
    category: "system",
    description: "Services, CPU, and AI provider at a glance.",
    variants: COMPACT,
    defaultVariant: "small",
    defaultSkin: "cortex",
    previewGradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
  },
  {
    key: "quote",
    label: "Quote",
    icon: "💬",
    category: "productivity",
    description: "Daily inspiration.",
    variants: STANDARD,
    defaultVariant: "small",
    defaultSkin: "ios",
  },
];

export function getRegistryEntry(key: string): WidgetRegistryEntry | undefined {
  return WIDGET_REGISTRY.find((w) => w.key === key);
}

export function getRegistryByCategory(): { category: WidgetRegistryEntry["category"]; items: WidgetRegistryEntry[] }[] {
  const order: WidgetRegistryEntry["category"][] = [
    "productivity",
    "calendar",
    "email",
    "music",
    "system",
    "automations",
    "analytics",
  ];
  return order.map((category) => ({
    category,
    items: WIDGET_REGISTRY.filter((w) => w.category === category),
  })).filter((g) => g.items.length > 0);
}

/** Legacy shape for canvas toolbar / variant pickers */
export function getCanvasWidgetTypes() {
  return WIDGET_REGISTRY.map(({ key, label, icon, variants, defaultVariant }) => ({
    key,
    label,
    icon,
    variants,
    defaultVariant,
  }));
}
