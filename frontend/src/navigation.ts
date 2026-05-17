import type { Tab } from "./App";

/** Single source for primary nav (sidebar + mobile drawer). */
export const CORTEX_MAIN_NAV: Array<{ id: Tab; label: string; emoji: string }> = [
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "tasks", label: "Tasks", emoji: "✅" },
  { id: "calendar", label: "Calendar", emoji: "📅" },
  { id: "ai", label: "AI", emoji: "🤖" },
  { id: "notes", label: "Notes", emoji: "📓" },
  { id: "memory", label: "Memory", emoji: "◎" },
  { id: "mail", label: "Mail", emoji: "📧" },
  { id: "spotify", label: "Music", emoji: "🎵" },
  { id: "link", label: "Cortex Link", emoji: "🔗" },
  { id: "settings", label: "Settings", emoji: "⚙️" },
];

/** App bar / screen titles (Material-style single-line headers). */
export const TAB_SCREEN_TITLES: Record<Tab, string> = {
  home: "Dashboard",
  tasks: "Tasks",
  calendar: "Calendar",
  ai: "AI",
  notes: "Notes",
  memory: "Memory",
  mail: "Mail",
  spotify: "Music",
  link: "Cortex Link",
  settings: "Settings",
};
