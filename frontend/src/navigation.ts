import type { Tab } from "./tab";

/** Lucide icon keys used by NavIcon (20px stroke in nav). */
export type NavIconName =
  | "home"
  | "check-square"
  | "target"
  | "calendar"
  | "bot"
  | "file-text"
  | "mail"
  | "music"
  | "settings"
  | "server"
  | "cloud";

export type NavItem = { id: Tab; label: string; icon: NavIconName };

/** Desktop sidebar + full nav reference. */
export const CORTEX_MAIN_NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "tasks", label: "Tasks", icon: "check-square" },
  { id: "ai", label: "AI", icon: "bot" },
  { id: "notes", label: "Notes", icon: "file-text" },
  { id: "mail", label: "Mail", icon: "mail" },
  { id: "cloud", label: "Cloud", icon: "cloud" },
  { id: "homelab", label: "Homelab", icon: "server" },
  { id: "spotify", label: "Music", icon: "music" },
  { id: "settings", label: "Settings", icon: "settings" },
];

/** Mobile bottom tab bar (design D2). */
export const CORTEX_MOBILE_TAB_NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "tasks", label: "Tasks", icon: "check-square" },
];

/** Mobile drawer — secondary destinations (design D2). */
export const CORTEX_MOBILE_DRAWER_NAV: NavItem[] = [
  { id: "mail", label: "Mail", icon: "mail" },
  { id: "cloud", label: "Cloud", icon: "cloud" },
  { id: "notes", label: "Notes", icon: "file-text" },
  { id: "spotify", label: "Music", icon: "music" },
  { id: "homelab", label: "Homelab", icon: "server" },
  { id: "settings", label: "Settings", icon: "settings" },
];

/** App bar / screen titles (Material-style single-line headers). */
export const TAB_SCREEN_TITLES: Record<Tab, string> = {
  home: "Dashboard",
  calendar: "Calendar",
  tasks: "Tasks & goals",
  goals: "Tasks & goals",
  ai: "AI",
  notes: "Notes",
  mail: "Mail",
  cloud: "Cloud",
  homelab: "Homelab",
  spotify: "Music",
  settings: "Settings",
};
