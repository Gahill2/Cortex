import type { Tab } from "./tab";

/** Lucide icon keys used by NavIcon (20px stroke in nav). */
export type NavIconName =
  | "home"
  | "check-square"
  | "calendar"
  | "bot"
  | "file-text"
  | "mail"
  | "music"
  | "settings";

export type NavItem = { id: Tab; label: string; icon: NavIconName };

/** Desktop sidebar + full nav reference. */
export const CORTEX_MAIN_NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "tasks", label: "Tasks & Calendar", icon: "check-square" },
  { id: "ai", label: "AI", icon: "bot" },
  { id: "notes", label: "Notes", icon: "file-text" },
  { id: "mail", label: "Mail", icon: "mail" },
  { id: "spotify", label: "Music", icon: "music" },
  { id: "settings", label: "Settings", icon: "settings" },
];

/** Mobile bottom tab bar (design D2). */
export const CORTEX_MOBILE_TAB_NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "tasks", label: "Tasks", icon: "check-square" },
  { id: "mail", label: "Mail", icon: "mail" },
  { id: "ai", label: "AI", icon: "bot" },
];

/** Mobile drawer — secondary destinations (design D2). */
export const CORTEX_MOBILE_DRAWER_NAV: NavItem[] = [
  { id: "calendar", label: "Tasks & Calendar", icon: "calendar" },
  { id: "notes", label: "Notes", icon: "file-text" },
  { id: "spotify", label: "Music", icon: "music" },
  { id: "settings", label: "Settings", icon: "settings" },
];

/** App bar / screen titles (Material-style single-line headers). */
export const TAB_SCREEN_TITLES: Record<Tab, string> = {
  home: "Dashboard",
  tasks: "Tasks & Calendar",
  calendar: "Tasks & Calendar",
  ai: "AI",
  notes: "Notes",
  mail: "Mail",
  spotify: "Music",
  settings: "Settings",
};
