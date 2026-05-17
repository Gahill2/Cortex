import type { Tab } from "../../App"; // type-only; App is already loaded when Home chunk loads

export const CORTEX_HOME_HERO_STORAGE_KEY = "cortex_home_hero_config";

export const MAX_COVER_IMAGE_URL_LEN = 2000;
export const MAX_PAGE_ICON_LEN = 16;
export const MAX_PAGE_TITLE_LEN = 120;
export const MAX_QUOTE_LEN = 2000;
export const MAX_LINK_LABEL_LEN = 80;
export const MAX_GROUP_TITLE_LEN = 80;

export type HomeHeroLink = {
  id: string;
  label: string;
  /** In-app tab when no external href */
  tab?: Tab;
  /** https? only; opens new tab */
  href?: string;
};

export type HomeHeroLinkGroup = {
  id: string;
  title: string;
  links: HomeHeroLink[];
};

export type HomeHeroConfig = {
  version: 1;
  coverPreset: string;
  coverImageUrl: string;
  pageIcon: string;
  pageTitle: string;
  quote: string;
  linkGroups: HomeHeroLinkGroup[];
};

export const HERO_TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "tasks", label: "Tasks" },
  { value: "calendar", label: "Calendar" },
  { value: "mail", label: "Mail" },
  { value: "notes", label: "Notes" },
  { value: "ai", label: "AI" },
  { value: "spotify", label: "Spotify" },
  { value: "settings", label: "Settings" },
];

/** Curated Unsplash covers (https URLs only). Pick in Customize → Cover photos. */
export const COVER_IMAGE_PRESETS: { id: string; label: string; url: string }[] = [
  {
    id: "greenhouse",
    label: "Greenhouse",
    url: "https://images.unsplash.com/photo-1502086223711-7ea6edc9d1ed?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "plants",
    label: "Indoor garden",
    url: "https://images.unsplash.com/photo-1466695243647-34ecfa4c65bb?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "mountains",
    label: "Mountains",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "ocean",
    label: "Ocean",
    url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "desk",
    label: "Workspace",
    url: "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "night",
    label: "Night sky",
    url: "https://images.unsplash.com/photo-1419242902214-272c403dfcc9?auto=format&fit=crop&w=1600&q=80",
  },
];

export const COVER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "mist", label: "Mist", css: "linear-gradient(135deg, #e0e7ff 0%, #fae8ff 50%, #fce7f3 100%)" },
  { id: "dawn", label: "Dawn", css: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(120deg, #0c3483 0%, #4484ce 55%, #a2b6df 100%)" },
  { id: "sand", label: "Sand", css: "linear-gradient(165deg, #fdfbf7 0%, #e8dfd4 40%, #c4b5a0 100%)" },
  { id: "forest", label: "Forest", css: "linear-gradient(145deg, #134e5e 0%, #71b280 100%)" },
  { id: "ember", label: "Ember", css: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)" },
  { id: "noir", label: "Noir", css: "linear-gradient(160deg, #232526 0%, #414345 100%)" },
  { id: "paper", label: "Paper", css: "linear-gradient(180deg, #ffffff 0%, #f1f1ef 100%)" },
];

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultHomeHeroConfig(): HomeHeroConfig {
  return {
    version: 1,
    coverPreset: "forest",
    coverImageUrl: COVER_IMAGE_PRESETS[0].url,
    pageIcon: "🌳",
    pageTitle: "Personal Home",
    quote: "A minute a day keeps life's worries at bay.",
    linkGroups: [
      {
        id: newId(),
        title: "✅ To-Do",
        links: [
          { id: newId(), label: "Open Tasks", tab: "tasks" },
          { id: newId(), label: "Calendar", tab: "calendar" },
        ],
      },
      {
        id: newId(),
        title: "🪞 Reflections",
        links: [
          { id: newId(), label: "Notes", tab: "notes" },
          { id: newId(), label: "AI chat", tab: "ai" },
        ],
      },
    ],
  };
}

export function isAllowedCoverImageUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > MAX_COVER_IMAGE_URL_LEN) return false;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function parseTab(v: unknown): Tab | undefined {
  const s = typeof v === "string" ? v : "";
  const ok = HERO_TAB_OPTIONS.some((o) => o.value === s);
  return ok ? (s as Tab) : undefined;
}

function normalizeLink(raw: unknown): HomeHeroLink {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hrefRaw = typeof o.href === "string" ? o.href.trim() : "";
  const href = hrefRaw && isAllowedCoverImageUrl(hrefRaw) ? clampStr(hrefRaw, MAX_COVER_IMAGE_URL_LEN) : undefined;
  const tab = href ? undefined : parseTab(o.tab) ?? "tasks";
  return {
    id: typeof o.id === "string" && o.id ? o.id : newId(),
    label: clampStr(typeof o.label === "string" ? o.label : "Link", MAX_LINK_LABEL_LEN),
    tab,
    href: href || undefined,
  };
}

function normalizeGroup(raw: unknown): HomeHeroLinkGroup {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const linksRaw = Array.isArray(o.links) ? o.links : [];
  const links = linksRaw.map(normalizeLink).filter((l) => l.label.length > 0);
  return {
    id: typeof o.id === "string" && o.id ? o.id : newId(),
    title: clampStr(typeof o.title === "string" ? o.title : "Links", MAX_GROUP_TITLE_LEN),
    links: links.length ? links : [{ id: newId(), label: "Tasks", tab: "tasks" }],
  };
}

/** Merge persisted value with defaults; safe for localStorage JSON */
export function normalizeHomeHeroConfig(raw: unknown): HomeHeroConfig {
  const base = defaultHomeHeroConfig();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const preset = typeof o.coverPreset === "string" && COVER_PRESETS.some((p) => p.id === o.coverPreset) ? o.coverPreset : base.coverPreset;
  const coverImageRaw = typeof o.coverImageUrl === "string" ? o.coverImageUrl.trim() : "";
  const coverImageUrl =
    coverImageRaw && isAllowedCoverImageUrl(coverImageRaw) ? clampStr(coverImageRaw, MAX_COVER_IMAGE_URL_LEN) : "";
  const pageIcon = clampStr(typeof o.pageIcon === "string" ? o.pageIcon : base.pageIcon, MAX_PAGE_ICON_LEN) || base.pageIcon;
  const pageTitle = clampStr(typeof o.pageTitle === "string" ? o.pageTitle : base.pageTitle, MAX_PAGE_TITLE_LEN) || base.pageTitle;
  const quote = clampStr(typeof o.quote === "string" ? o.quote : base.quote, MAX_QUOTE_LEN);
  let linkGroups: HomeHeroLinkGroup[] = base.linkGroups;
  if (Array.isArray(o.linkGroups) && o.linkGroups.length > 0) {
    linkGroups = o.linkGroups.map(normalizeGroup).filter((g) => g.title.length > 0);
    if (linkGroups.length === 0) linkGroups = base.linkGroups;
  }
  return {
    version: 1,
    coverPreset: preset,
    coverImageUrl,
    pageIcon,
    pageTitle,
    quote,
    linkGroups,
  };
}
