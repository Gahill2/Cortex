# Cortex Design System

> Extracted from `frontend/src/styles.css`, `styles-home-prod.css`, and `styles-widgets.css`.  
> Tone: **personal command-layer dashboard** — dark glass shell, glanceable bento home, integrations as secondary chrome.

## Product context

Cortex is a unified desktop/web shell for tasks, mail, calendar, AI, and connected services. The production home (`HomeProduction`) is a **fixed bento layout** (no drag grid): hero greeting, clock/weather glance row, KPI strip, “Today” widget grid, and a collapsible connections panel. Visual hierarchy favors **one border per tile**: outer `.home-prod-card` owns radius and surface; inner `.widget` is flattened inside bento shells to avoid double chrome.

## Typography

| Role | Stack | Usage |
|------|--------|--------|
| UI / brand | `Plus Jakarta Sans` (`--font-brand`) | Body, nav, widgets, wordmark |
| Base size | `13px` on `body` | App default |
| Hero title | `clamp(1.75rem, 4vw, 2.25rem)`, weight `800`, letter-spacing `-0.04em` | `.home-prod-title` |
| Section labels | `0.75rem`, weight `700`, uppercase, letter-spacing `0.08em` | `.home-prod-section__title`, `.widget-label` |
| KPI values | `1.25rem`, weight `700` | `.home-prod-kpi__value` |
| Widget CTA | `12–14px`; links weight `600` | `.widget-cta-text`, `.widget-cta-link` |

Wordmark (`.cortex-brand__wordmark`): weight `800`, tight tracking. Hero favicon sits in a **white chip** (`.cortex-brand__img` with `#fff` background, rounded corners).

## Color

### Core tokens (`:root`)

| Token | Value | Role |
|-------|--------|------|
| `--bg` | `#0e0e10` | App canvas |
| `--bg-2` / `--bg-3` | `#141418` / `#1a1a20` | Rails, inset surfaces |
| `--surface` / `--surface-2` | `#1e1e26` / `#25252f` | Cards, hovers |
| `--text` | `#f0f0f5` | Primary copy |
| `--text-2` / `--text-3` | ~55% / ~28% white | Secondary, meta |
| `--accent` | `#5b8dff` | Links, active nav, CTAs |
| `--green` | `#3be8ad` | Success, live status |
| `--amber` / `--red` | `#f5a623` / `#ff5f5f` | Warnings, errors |

### Brand gradient

- `--brand-gradient`: `135deg`, `#5b8dff` → `#3be8ad`
- Dim fills: `--brand-blue-dim`, `--brand-teal-dim`, `--accent-dim`, `--green-dim`
- Glow (optional hero): `--brand-glow` radial at top

### Semantic aliases (dashboard)

| Alias | Maps to |
|-------|---------|
| `--surface-0` | `--bg` |
| `--surface-1` | `--surface` |
| `--border-strong` | `--border-2` |
| `--text-1` | `--text` |

### Borders & glass

- Default border: `--border` `rgba(255,255,255,0.07)`
- Strong border: `--border-2` `rgba(255,255,255,0.12)`
- Widget glass: `--widget-glass-bg` `rgba(26,26,34,0.96)` with `--widget-shadow` / `--widget-shadow-hover`

Light scheme overrides apply on `html[data-color-scheme="light"]:not(.cortex-notion)` before Notion shell classes load.

## Spacing (8px grid)

| Token | Size |
|-------|------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-7` | 32px |

**Home production rhythm:** page padding `16px` horizontal, `24–32px` bottom; section gaps `16px` / `24px`; bento grid gap `16px`; KPI row gap `8px`. Mobile (`home-prod--mobile`) tightens vertical padding to `8px` top, `24px` bottom.

## Layout

| Element | Behavior |
|---------|----------|
| Shell | Sidebar `--sidebar-w: 220px`; main scrolls inside `.desktop-main` |
| Home max width | `1120px` centered (full bleed on mobile) |
| Glance row | 2-column grid; stacks at `≤520px` |
| KPI row | 3 equal columns |
| Bento | 2-column grid; min-heights `160px` desktop / `144px` mobile for tasks, mail, spotify, AI |
| Connections | `<details>` panel, collapsed by default on narrow viewports |

### Bento / widget nesting

```css
.home-prod-card .widget {
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 16px;
}
```

Outer `.home-prod-card` uses `--radius-xl` (`22px`) and `--surface-1`. Do not re-apply widget border/shadow inside production bento.

## Radius

| Token | Size |
|-------|------|
| `--radius-sm` | 6px |
| `--radius` / `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 22px |

Brand favicon chips: `10–12px` radius on app bar / hero variants.

## Motion

| Pattern | Duration | Easing |
|---------|----------|--------|
| Nav / buttons | `120ms` | default |
| Widget hover | `140ms` | ease |
| KPI / integration rows | `150ms` | default |
| Clock colon | `1s` | ease-in-out infinite |
| Clock shimmer | `6s` | linear infinite |
| Status dot pulse | `2s` | ease-in-out infinite |
| Spotify art glow | `2s` | ease-in-out infinite |

Prefer short transitions on border, background, and box-shadow — no layout-thrashing animations on the home grid.

## Components (reference)

- **CortexBrand** — `sidebar` | `appbar` | `hero`; white-chip favicon; optional wordmark.
- **`.widget`** — Standalone tiles with glass border + shadow; used on legacy grid and inside bento (flattened).
- **`.widget-cta`** — Empty/connected states; `.widget-cta-link` accent text with hover shift toward `--green`.
- **Mail compact** — `.widget--gmail-compact` + `.gmail-row-v2` / `.mail-avatar` in `styles-widgets.css`; home-prod caps list height.
- **Mobile tab bar** — Fixed bottom, blur backdrop, safe-area insets.

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/styles.css` | Global tokens, shell, widgets base, CTA |
| `frontend/src/styles-home-prod.css` | Production home, brand, mobile tab bar |
| `frontend/src/styles-widgets.css` | Widget-specific polish (mail rows, spotify, AI pill, weather) |

When adding UI, extend tokens in `styles.css` first, then scope overrides in `styles-home-prod.css` or `styles-widgets.css` — avoid one-off hex values in components.
