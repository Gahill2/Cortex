import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Link2,
  Keyboard,
  Palette,
  Plug,
  User,
} from "lucide-react";

export type SettingsSectionId =
  | "account"
  | "appearance"
  | "integrations"
  | "shortcuts"
  | "memory"
  | "cortex-link";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type SettingsNavGroup = {
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "User settings",
    items: [
      {
        id: "account",
        label: "My account",
        icon: User,
        description: "Session, sign out, and lock",
      },
    ],
  },
  {
    label: "App settings",
    items: [
      {
        id: "appearance",
        label: "Appearance",
        icon: Palette,
        description: "Theme, wallpaper, and AI colors",
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        description: "Spotify, Notion, Canva, and vault",
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        icon: Keyboard,
      },
    ],
  },
  {
    label: "Advanced",
    items: [
      {
        id: "memory",
        label: "Memory",
        icon: Brain,
        description: "Agentmemory and Obsidian search",
      },
      {
        id: "cortex-link",
        label: "Cortex Link",
        icon: Link2,
        description: "MCP over Tailscale for remote agents",
      },
    ],
  },
];

export const SETTINGS_SECTION_LABELS: Record<SettingsSectionId, string> = {
  account: "My account",
  appearance: "Appearance",
  integrations: "Integrations",
  shortcuts: "Keyboard shortcuts",
  memory: "Memory",
  "cortex-link": "Cortex Link",
};

export const CORTEX_SETTINGS_SECTION_KEY = "cortex_settings_section";

export function readSettingsSection(): SettingsSectionId | null {
  try {
    const raw = sessionStorage.getItem(CORTEX_SETTINGS_SECTION_KEY);
    if (!raw) return null;
    const all = SETTINGS_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    return all.includes(raw as SettingsSectionId) ? (raw as SettingsSectionId) : null;
  } catch {
    return null;
  }
}

export function writeSettingsSection(id: SettingsSectionId): void {
  try {
    sessionStorage.setItem(CORTEX_SETTINGS_SECTION_KEY, id);
  } catch {
    /* ignore */
  }
}
