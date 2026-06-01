import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useToastStore } from "../../stores/toastStore";
import type { Tab } from "../../App";
import { useHomeHeroConfig } from "../../hooks/useHomeHeroConfig";
import {
  COVER_IMAGE_PRESETS,
  COVER_PRESETS,
  HERO_TAB_OPTIONS,
  MAX_COVER_IMAGE_URL_LEN,
  MAX_GROUP_TITLE_LEN,
  MAX_LINK_LABEL_LEN,
  MAX_PAGE_ICON_LEN,
  MAX_PAGE_TITLE_LEN,
  MAX_QUOTE_LEN,
  defaultHomeHeroConfig,
  isAllowedCoverImageUrl,
  normalizeHomeHeroConfig,
  type HomeHeroConfig,
  type HomeHeroLink,
} from "./homeHeroConfig";
import { writeSettingsSection } from "../../settingsNavigation";

type Props = { onNavigate: (t: Tab) => void };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneConfig(c: HomeHeroConfig): HomeHeroConfig {
  return JSON.parse(JSON.stringify(c)) as HomeHeroConfig;
}

function openHeroLink(link: HomeHeroLink, onNavigate: (t: Tab) => void) {
  const href = link.href?.trim();
  if (href && isAllowedCoverImageUrl(href)) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  if (!link.tab) return;
  const legacy = link.tab as string;
  if (legacy === "calendar") {
    onNavigate("tasks");
    return;
  }
  if (legacy === "link" || legacy === "memory") {
    writeSettingsSection(legacy === "link" ? "cortex-link" : "memory");
    onNavigate("settings");
    return;
  }
  onNavigate(link.tab);
}

function clampStr(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max);
}

function cssUrlValue(url: string): string {
  const escaped = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

function startOfCalendarMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildCalendarGrid(view: Date): { label: string; inMonth: boolean; isToday: boolean; key: string }[] {
  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const isToday = (day: number) =>
    day > 0 &&
    day <= daysInMonth &&
    today.getFullYear() === y &&
    today.getMonth() === m &&
    today.getDate() === day;

  const cells: { label: string; inMonth: boolean; isToday: boolean; key: string }[] = [];
  let dayCounter = 1 - startPad;
  for (let i = 0; i < 42; i++) {
    dayCounter += 1;
    const inMonth = dayCounter >= 1 && dayCounter <= daysInMonth;
    const label = inMonth ? String(dayCounter) : "";
    cells.push({
      label,
      inMonth,
      isToday: inMonth && isToday(dayCounter),
      key: `${y}-${m}-${i}-${dayCounter}`,
    });
  }
  return cells;
}

function HeroClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const dateLine = t.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="home-hero-clock" aria-live="polite">
      <p className="home-hero-clock-time">{time}</p>
      <p className="home-hero-clock-date">{dateLine}</p>
    </div>
  );
}

function HeroCalendar() {
  const [view, setView] = useState(() => startOfCalendarMonth(new Date()));
  const grid = useMemo(() => buildCalendarGrid(view), [view]);
  const title = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const prev = () => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
  const next = () => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
  const weekLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return (
    <div className="home-hero-cal">
      <div className="home-hero-cal-head">
        <button type="button" className="home-hero-cal-nav" onClick={prev} aria-label="Previous month">
          ‹
        </button>
        <span className="home-hero-cal-title">{title}</span>
        <button type="button" className="home-hero-cal-nav" onClick={next} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="home-hero-cal-week">
        {weekLabels.map((w) => (
          <span key={w} className="home-hero-cal-wd">
            {w}
          </span>
        ))}
      </div>
      <div className="home-hero-cal-grid">
        {grid.map((c) => (
          <span
            key={c.key}
            className={["home-hero-cal-cell", c.inMonth ? "home-hero-cal-cell--in" : "", c.isToday ? "home-hero-cal-cell--today" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeNotionHero({ onNavigate }: Props) {
  const [config, setConfig] = useHomeHeroConfig();
  const safe = useMemo(() => normalizeHomeHeroConfig(config), [config]);

  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<HomeHeroConfig>(() => cloneConfig(safe));

  const openCustomize = () => {
    setDraft(cloneConfig(safe));
    setCustomOpen(true);
  };

  const presetCss = COVER_PRESETS.find((p) => p.id === safe.coverPreset)?.css ?? COVER_PRESETS[0].css;
  const coverStyle: CSSProperties = safe.coverImageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35)), ${cssUrlValue(safe.coverImageUrl)}`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: presetCss };

  const applyDraft = () => {
    setConfig(normalizeHomeHeroConfig(draft));
    setCustomOpen(false);
  };

  const pushToast = useToastStore((s) => s.push);

  const [resetConfirming, setResetConfirming] = useState(false);
  const resetAll = () => {
    if (!resetConfirming) {
      setResetConfirming(true);
      setTimeout(() => setResetConfirming(false), 3000);
      return;
    }
    setResetConfirming(false);
    const fresh = defaultHomeHeroConfig();
    setConfig(fresh);
    setDraft(cloneConfig(fresh));
    setCustomOpen(false);
    pushToast({ title: "Layout reset", message: "Home layout restored to defaults.", tone: "neutral" });
  };

  const updateDraft = useCallback((fn: (d: HomeHeroConfig) => HomeHeroConfig) => {
    setDraft((d) => fn(cloneConfig(d)));
  }, []);

  const addGroup = () =>
    updateDraft((d) => ({
      ...d,
      linkGroups: [...d.linkGroups, { id: newId(), title: "New group", links: [{ id: newId(), label: "Tasks", tab: "tasks" }] }],
    }));

  const removeGroup = (gid: string) =>
    updateDraft((d) => ({
      ...d,
      linkGroups: d.linkGroups.filter((g) => g.id !== gid),
    }));

  const patchGroup = (gid: string, title: string) =>
    updateDraft((d) => ({
      ...d,
      linkGroups: d.linkGroups.map((g) => (g.id === gid ? { ...g, title: clampStr(title, MAX_GROUP_TITLE_LEN) } : g)),
    }));

  const addLink = (gid: string) =>
    updateDraft((d) => ({
      ...d,
      linkGroups: d.linkGroups.map((g) =>
        g.id === gid ? { ...g, links: [...g.links, { id: newId(), label: "Link", tab: "tasks" }] } : g
      ),
    }));

  const removeLink = (gid: string, lid: string) =>
    updateDraft((d) => ({
      ...d,
      linkGroups: d.linkGroups.map((g) => {
        if (g.id !== gid) return g;
        const next = g.links.filter((l) => l.id !== lid);
        return { ...g, links: next.length ? next : g.links };
      }),
    }));

  const patchLink = (gid: string, lid: string, patch: Partial<HomeHeroLink>) =>
    updateDraft((d) => ({
      ...d,
      linkGroups: d.linkGroups.map((g) =>
        g.id === gid
          ? {
              ...g,
              links: g.links.map((l) => {
                if (l.id !== lid) return l;
                const next = { ...l, ...patch };
                const href = next.href?.trim();
                if (href && isAllowedCoverImageUrl(href)) {
                  return { ...next, href: clampStr(href, MAX_COVER_IMAGE_URL_LEN), tab: undefined };
                }
                return { ...next, href: undefined, tab: next.tab ?? "tasks" };
              }),
            }
          : g
      ),
    }));

  useEffect(() => {
    if (!customOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customOpen]);

  return (
    <section className="home-hero" aria-label="Personal home">
      <div className="home-hero-cover" style={coverStyle} role="presentation" />

      <div className="home-hero-sheet">
        <div className="home-hero-title-row">
          <span className="home-hero-page-icon" aria-hidden>
            {safe.pageIcon || "🏠"}
          </span>
          <h1 className="home-hero-page-title">{safe.pageTitle}</h1>
          <div className="home-hero-title-actions">
            <button type="button" className="home-hero-customize-btn" onClick={openCustomize} title="Customize home">
              <span aria-hidden>⚙</span>
              <span className="home-hero-customize-label">Customize</span>
            </button>
          </div>
        </div>

        {safe.quote.trim() ? (
          <blockquote className="home-hero-callout">
            <span className="home-hero-callout-bar" aria-hidden />
            <p className="home-hero-callout-text">{safe.quote}</p>
          </blockquote>
        ) : null}

        <div className="home-hero-columns">
          <div className="home-hero-col home-hero-col--links">
            {safe.linkGroups.map((g) => (
              <div key={g.id} className="home-hero-link-card">
                <h2 className="home-hero-card-title">{g.title}</h2>
                <ul className="home-hero-link-list">
                  {g.links.map((l) => (
                    <li key={l.id}>
                      <button type="button" className="home-hero-link-row" onClick={() => openHeroLink(l, onNavigate)}>
                        <span className="home-hero-link-chev" aria-hidden>
                          ›
                        </span>
                        <span className="home-hero-link-label">{l.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="home-hero-col home-hero-col--clock">
            <div className="home-hero-mid-card">
              <HeroClock />
            </div>
          </div>
          <div className="home-hero-col home-hero-col--cal">
            <div className="home-hero-mid-card home-hero-mid-card--cal">
              <HeroCalendar />
            </div>
          </div>
        </div>
      </div>

      {customOpen ? (
        <div className="home-hero-modal-overlay" role="presentation" onClick={() => setCustomOpen(false)}>
          <div
            className="home-hero-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-hero-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="home-hero-modal-head">
              <h2 id="home-hero-modal-title">Customize home</h2>
              <button type="button" className="home-hero-modal-x" aria-label="Close" onClick={() => setCustomOpen(false)}>
                ×
              </button>
            </div>
            <div className="home-hero-modal-body">
              <label className="home-hero-field">
                <span>Cover gradient</span>
                <select
                  className="form-input"
                  value={draft.coverPreset}
                  onChange={(e) => setDraft((d) => ({ ...d, coverPreset: e.target.value }))}
                >
                  {COVER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="home-hero-field">
                <span>Cover photos</span>
                <div className="home-hero-cover-grid" role="list">
                  <button
                    type="button"
                    role="listitem"
                    className={`home-hero-cover-thumb home-hero-cover-thumb--none${!draft.coverImageUrl ? " is-active" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, coverImageUrl: "" }))}
                  >
                    <span className="home-hero-cover-thumb-label">Gradient only</span>
                  </button>
                  {COVER_IMAGE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="listitem"
                      className={`home-hero-cover-thumb${draft.coverImageUrl === p.url ? " is-active" : ""}`}
                      style={{ backgroundImage: `url(${p.url.replace(/w=1600/, "w=400")})` }}
                      title={p.label}
                      onClick={() => setDraft((d) => ({ ...d, coverImageUrl: p.url }))}
                    >
                      <span className="home-hero-cover-thumb-label">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="home-hero-field">
                <span>Custom cover image URL (https only recommended)</span>
                <input
                  className="form-input"
                  placeholder="https://…"
                  maxLength={MAX_COVER_IMAGE_URL_LEN}
                  value={draft.coverImageUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, coverImageUrl: e.target.value }))}
                />
                <span className="home-hero-hint">
                  Pick a photo above, paste any https image link, or leave empty to use the gradient only.
                </span>
              </label>
              <label className="home-hero-field">
                <span>Page icon (emoji)</span>
                <input
                  className="form-input"
                  maxLength={MAX_PAGE_ICON_LEN}
                  value={draft.pageIcon}
                  onChange={(e) => setDraft((d) => ({ ...d, pageIcon: e.target.value }))}
                />
              </label>
              <label className="home-hero-field">
                <span>Page title</span>
                <input
                  className="form-input"
                  maxLength={MAX_PAGE_TITLE_LEN}
                  value={draft.pageTitle}
                  onChange={(e) => setDraft((d) => ({ ...d, pageTitle: e.target.value }))}
                />
              </label>
              <label className="home-hero-field">
                <span>Quote / callout</span>
                <textarea
                  className="form-input home-hero-textarea"
                  rows={3}
                  maxLength={MAX_QUOTE_LEN}
                  value={draft.quote}
                  onChange={(e) => setDraft((d) => ({ ...d, quote: e.target.value }))}
                />
              </label>

              <div className="home-hero-groups-editor">
                <div className="home-hero-groups-head">
                  <span>Link cards</span>
                  <button type="button" className="btn-ghost btn-sm" onClick={addGroup}>
                    + Group
                  </button>
                </div>
                {draft.linkGroups.map((g) => (
                  <div key={g.id} className="home-hero-group-block">
                    <div className="home-hero-group-row">
                      <input
                        className="form-input"
                        value={g.title}
                        maxLength={MAX_GROUP_TITLE_LEN}
                        onChange={(e) => patchGroup(g.id, e.target.value)}
                        aria-label="Group title"
                      />
                      <button type="button" className="btn-ghost btn-sm" onClick={() => removeGroup(g.id)} disabled={draft.linkGroups.length <= 1}>
                        Remove
                      </button>
                    </div>
                    <button type="button" className="btn-ghost btn-sm mb-2" onClick={() => addLink(g.id)}>
                      + Link
                    </button>
                    {g.links.map((l) => (
                      <div key={l.id} className="home-hero-link-edit-row">
                        <input
                          className="form-input"
                          placeholder="Label"
                          maxLength={MAX_LINK_LABEL_LEN}
                          value={l.label}
                          onChange={(e) => patchLink(g.id, l.id, { label: e.target.value })}
                        />
                        <select
                          className="form-input"
                          value={l.tab ?? "tasks"}
                          onChange={(e) => patchLink(g.id, l.id, { tab: e.target.value as Tab, href: undefined })}
                        >
                          {HERO_TAB_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="form-input"
                          placeholder="External https URL (optional)"
                          maxLength={MAX_COVER_IMAGE_URL_LEN}
                          value={l.href ?? ""}
                          onChange={(e) => patchLink(g.id, l.id, { href: e.target.value })}
                        />
                        <button type="button" className="btn-ghost btn-sm" onClick={() => removeLink(g.id, l.id)} disabled={g.links.length <= 1}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="home-hero-modal-foot">
              <button type="button" className={`btn-ghost btn-sm${resetConfirming ? " confirm-pending" : ""}`} onClick={resetAll}>
                {resetConfirming ? "Confirm reset?" : "Reset to defaults"}
              </button>
              <div className="home-hero-modal-foot-right">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setCustomOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={applyDraft}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
