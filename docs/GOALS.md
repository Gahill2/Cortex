# Cortex Development Roadmap

> Last updated: 2026-05-16  
> Status: 57 of 142 goals complete  
> **North star:** Unify `main` + `feat/firebase-dashboard-integrations`, put **all durable data online** (Firestore), ship via **public link** (hosted web + downloadable desktop) — App Store optional later.

## Legend

- [x] Done  [ ] Todo  [~] In progress
- [S] Hours  [M] 1-3 days  [L] 1-2 weeks  [XL] 1+ month

**Evidence rule:** Items marked `[x]` were verified in this repo (routes, pages, config, or docs on disk). No Steam/Discord API integration exists yet (icons/heuristics only).

**Two code lines to merge:**

| Line | Branch / tree | What it adds |
|------|----------------|--------------|
| **A — Desktop + Notion home** | `main` (+ local WIP) | PIN gate, Notion shell, briefing, Canva, MCP, Microsoft/calendar, mobile nav, CI fix |
| **B — Integrations hub** | `origin/feat/firebase-dashboard-integrations` | Firebase Admin, Firestore env sync, billing, agent memory, mail-account reshape, integrations UI |

Do **not** blind-merge B — cherry-pick Firebase + billing slices, reconcile mail/Prisma with A.

---

## Phase 0 — Unify merges + online data (priority)

> Firestore as source of truth across web, Electron, and second machine. Env doc in Firestore is step 1 only.

- [x] [S] Firestore `cortex_config/env` populated with backend secrets (manual upload + optional `npm run sync:env:push`)
- [x] [M] Firebase Admin + env sync in repo (`backend/src/features/firebase/*`, `sync-env-firestore.ts`, `docs/firebase-setup.md`, npm scripts)
- [ ] [L] Merge plan: commit or stash `main` WIP → integrate B in slices → resolve mail/`MailAccount` schema vs local WIP
- [x] [M] `GET /api/firebase/status` + `npm run sync:env:pull|push` on every dev machine
- [ ] [L] Repository layer (`SettingsRepository`, `TaskRepository`, `TokenRepository`) — Prisma + Firestore implementations
- [ ] [M] `GET/PATCH /api/settings` — move `cortex_*` localStorage prefs to Firestore `users/{uid}/settings`
- [ ] [L] Firebase Auth (or Firebase token → Cortex JWT exchange) — same `uid` on laptop + browser
- [ ] [L] Dual-write tasks/projects/org → cut over with `DATA_BACKEND=firestore` flag
- [ ] [M] OAuth + mail account metadata in Firestore (tokens **Admin SDK only**, never client-readable)
- [ ] [M] Electron: shared production API URL; stop treating per-machine `cortex.db` as sole source of truth
- [ ] [M] Firestore security rules: deny client on `cortex_config/**` and `integrations/**`
- [ ] [S] Document recovery: export Firestore settings + optional SQLite one-time migration script

---

## Phase 1 — Foundation

> Express API, auth, Prisma/SQLite data, Supabase migration artifacts, desktop hosts

- [x] [S] Express app with `helmet`, `cors`, `morgan`, JSON body (`backend/src/app.ts`)
- [x] [S] Cortex router at `/api` mounting feature routers (`backend/src/routes/cortex/index.ts`)
- [x] [M] JWT auth: login, verify-pin, session, lock, logout, desktop-token, OTP send/verify (`backend/src/routes/cortex/auth.routes.ts`)
- [x] [M] OTP email sign-in UI (`frontend/src/pages/LoginPage.tsx`)
- [x] [M] Zod request parsing + per-route rate limits on cortex auth (and other cortex routes)
- [x] [M] Prisma schema targeting SQLite with `OAuthToken`, `MailAccount`, org/task models (`backend/prisma/schema.prisma`)
- [x] [M] Supabase SQL migrations `001_initial_schema.sql` + `002_rls_baseline.sql` (`supabase/migrations/`)
- [x] [S] Web client stores JWT in `localStorage` (`frontend/src/App.tsx` `TOKEN_KEY`)
- [x] [M] Electron main process: single instance, `cortex://` deep links for OAuth callbacks (`electron/main.ts`)
- [x] [S] AGENTS.md documents skill routing and OpenClaw-as-host guidance (no OpenClaw wiring in tracked app source)
- [x] [M] SPA lock / PIN unlock flow calling `/auth/verify-pin` after sign-in (`SessionPinGate` in `App.tsx`)
- [x] [S] Idle timer in renderer posting `/auth/lock` (15m inactivity in `App.tsx`)
- [x] [S] CI build installs backend devDeps before `prisma generate` (root `package.json` `build:backend`)
- [ ] [L] Tauri shell beyond staging hooks — overlay + idle behind env flags (`apps/desktop/src-tauri/`)
- [ ] [M] Deprecate parallel Supabase-as-runtime path once Firestore cutover is done (migrations remain reference)

---

## Phase 2 — Shell Home + Module Grid

> Vite/React UI, home board, command surface, app discovery

- [x] [L] Production fixed bento home (`HomeProduction.tsx`) — primary dashboard on `main`: glance row, KPIs, Today bento (tasks, mail, Spotify, AI), connections strip
- [x] [L] Legacy draggable home widget grid (`HomePage.tsx`, `@dnd-kit`) — **superseded on `main`** by `HomeProduction`; drag/resize code retained for experiments, not the default shell path
- [x] [M] Home top rail: personal goals list, task stats, due-soon, quick links (`frontend/src/components/home/HomeDashboardTop.tsx`)
- [x] [M] Notion-style home hero (cover, emoji, link cards, customize modal) (`HomeNotionHero.tsx`, `homeHeroConfig.ts`)
- [x] [M] Command palette via `cmdk` + Radix dialog (`frontend/src/components/shell/CommandPalette.tsx`)
- [x] [M] Desktop keyboard shortcuts hook — e.g. Ctrl/Cmd+K toggles palette (`frontend/src/hooks/useDesktopShortcuts.ts`)
- [x] [M] Backend app discovery: `/apps/list`, `/apps/recent`, `/apps/launch` (`backend/src/routes/cortex/apps.routes.ts`)
- [x] [M] Sidebar + tab navigation across Home, Tasks, AI, Mail, Spotify, Calendar, Notes, Settings, MCP link (`frontend/src/App.tsx`, `Sidebar.tsx`, `navigation.ts`)
- [x] [S] `AppearanceProvider` — light / dark / system (`frontend/src/AppearanceProvider.tsx`)
- [x] [S] Mobile app bar + nav drawer for narrow viewports (`MobileAppBar.tsx`, `MobileNavDrawer.tsx`)
- [ ] [M] OS-level global hotkeys (Win+Space) — in-app shortcuts only today
- [ ] [M] System tray menu (lock, quit, settings) for packaged desktop
- [ ] [L] True always-on-top overlay window policy
- [ ] [M] Multi-monitor placement policy

---

## Phase 3 — Gmail + Mail

> Google Gmail API and multi-account mail

- [x] [M] Cortex `/gmail` router + `GmailPage`
- [x] [M] Cortex `/mail` router + `MailPage`
- [x] [S] Mail widget on home grid
- [ ] [M] Unread badge semantics polished across all mail accounts
- [ ] [L] Thread list UX parity with Gmail web (labels, filters)
- [ ] [M] Mark-read / archive actions from overlay
- [ ] [L] Push or polling + tray notification for new mail
- [ ] [M] OAuth error / reconnect UX matrix (Gmail, Microsoft, IMAP)
- [ ] [L] Full-text mail search from command palette
- [ ] [S] Offline inbox cache contract

---

## Phase 4 — Spotify + Music

> OAuth, playback, AI DJ

- [x] [M] Cortex `/spotify` router + `SpotifyPage`
- [x] [M] Spotify widget on home board
- [x] [M] Spotify OAuth via Electron deep link
- [x] [L] AI DJ backend surface (`spotify.routes.ts`)
- [ ] [M] Device picker + transfer playback hardened
- [ ] [M] Queue view (next N tracks) in UI
- [ ] [M] Playlist / liked-songs browser in UI
- [ ] [M] Lyrics overlay (third-party API)
- [ ] [S] Optional Last.fm scrobble
- [ ] [L] Listening history analytics card

---

## Phase 5 — AI Assistant

> Chat, themes, wiki context, briefing

- [x] [M] `AIPage` + cortex `/ai` routes
- [x] [M] AI-assisted theme generation (`SettingsPage` + `/ai/theme/generate`)
- [x] [M] Wiki routes (`backend/src/routes/cortex/wiki.routes.ts`)
- [x] [M] Today's briefing: `POST /ai/today-briefing` + home hero/modal (`ai.routes.ts`, `HomeDashboardTop.tsx`)
- [ ] [L] Durable `ai_conversations` / `ai_messages` in Firestore (not ephemeral)
- [ ] [M] Context injection package (mail + calendar + Spotify + Obsidian + Notion) with redaction
- [ ] [M] Natural-language command bar → structured actions
- [ ] [L] Voice loop (STT + TTS) for desktop
- [ ] [XL] Constrained agent mode controlling Cortex actions safely

---

## Phase 6 — Steam + Discord

> No dedicated Steam/Discord API modules (icons/heuristics only)

- [ ] [M] Steam Web API connect + settings surface
- [ ] [M] Current game / friends presence card
- [ ] [M] Discord Rich Presence read
- [ ] [L] Discord webhook or bot messaging from command bar
- [ ] [L] Achievement tracker
- [ ] [L] Gaming weekly recap card
- [ ] [M] Game session timer
- [ ] [XL] Steam Deck layout mode

---

## Phase 7 — Obsidian + Notion (Knowledge)

- [x] [M] Obsidian vault registry + routes (`obsidian.routes.ts`, `obsidian-vaults.json`)
- [x] [M] `NotesPage` for vault browsing
- [x] [M] Notion OAuth + `/notion` router
- [x] [S] `cortex-notion` root class + Notion-adjacent styles (`styles-notion-app.css`)
- [ ] [L] Quick capture from command bar → daily note / Notion page
- [ ] [L] Unified vault + Notion search in palette
- [ ] [M] Backlinks / graph mini-view
- [ ] [L] Templater-style templates
- [ ] [XL] AI summarization + suggested links across vault + Notion

---

## Phase 8 — Files + Automation

- [x] [M] Files router: recent + search (`files.routes.ts`)
- [ ] [L] File watcher feeding activity timeline
- [ ] [L] Timeline card in UI
- [ ] [L] Automation rules engine
- [ ] [M] Clipboard manager
- [ ] [L] Screenshot capture + filing
- [ ] [L] Window manager / snap from command bar

---

## Phase 9 — Settings + Personalization

- [x] [M] `SettingsPage` — integrations, appearance, AI theme lab, Canva section
- [x] [S] `useWallpaper` hook
- [x] [M] `useTheme` AI gradient persistence
- [x] [S] Reset Cortex UI preferences (`cortexUiStorageKeys.ts`)
- [ ] [M] PIN change / security settings end-to-end
- [ ] [L] Module layout editor separate from home drag grid (if desired)
- [ ] [M] JSON import/export of personalization (until Firestore owns it)
- [ ] [L] Onboarding wizard across integrations
- [ ] [L] Work/gaming/focus profiles
- [ ] [XL] Cross-device settings sync — **tracked in Phase 0** (Firestore `users/{uid}/settings`)

---

## Phase 10 — Performance + Polish

- [ ] [M] Cold start budget for Electron + local backend bundle
- [ ] [M] Offline degraded mode per module (optional local cache after cloud SoT)
- [ ] [L] Micro-animations pass (home + settings)
- [x] [S] Lazy-loaded heavy pages (`React.lazy` in `App.tsx`)
- [ ] [M] Sentry or equivalent crash reporting
- [ ] [L] Memory / RSS budget enforcement
- [ ] [M] Auto-updater wired (`electron-updater` dep exists; feed URL + signing)
- [ ] [L] Accessibility audit
- [ ] [L] Integration health dashboard (per-provider status)

---

## Phase 11 — Multi-User + Teams (stretch)

> `backend/src/routes/v1/*` exists but is **not** mounted in `app.ts`

- [ ] [XL] Mount `/api/v1` or fold into cortex multi-tenant + Firestore org rules
- [ ] [XL] Org-scoped module layouts
- [ ] [XL] Team presence
- [ ] [XL] Shared command actions
- [ ] [XL] Admin policy dashboard

---

## Phase 12 — Ship without App Store (link-first)

> **Primary path:** hosted web app URL + signed desktop installer download link. Stores are optional.

- [x] [M] Electron Builder config — NSIS (Win), DMG (mac), AppImage (Linux) (`package.json` `build` + `npm run dist`)
- [ ] [M] Hosted SPA build + static deploy (any CDN or object storage) — separate from API origin
- [ ] [M] Production API on stable HTTPS origin (Railway/Fly/Render/Cloud Run) — single `CORTEX_API_URL` for all clients
- [ ] [M] Public **download page**: latest installer + web app link + version notes (GitHub Releases or static site)
- [ ] [M] Environment matrix doc: dev (local), staging, prod (Firestore + API URLs)
- [ ] [L] Code signing — Windows Authenticode + Apple notarization (reduces Smart Gate warnings)
- [ ] [M] `electron-updater` channel — stable/beta JSON feed on Releases or S3
- [ ] [S] PWA / “Install app” from browser (manifest + service worker) for users who skip desktop
- [ ] [L] Optional Microsoft Store / Mac App Store packages (wrap existing installer — not required for launch)
- [ ] [XL] Stripe billing (freemium integrations) — partial design on feat branch `CortexProfile`
- [ ] [XL] Public module API + marketplace (stretch)

---

## Phase 13 — Microsoft 365 + Calendar + Weather

- [x] [M] `/microsoft` router
- [x] [M] `/calendar` router
- [x] [M] `/weather` router
- [x] [M] `CalendarPage` in SPA
- [ ] [M] Weather + calendar widgets polish (error states, units)
- [ ] [L] Unified scheduling assistant (AI + calendar + mail)

---

## Phase 14 — Canva + MCP (found in codebase)

- [x] [M] Canva PKCE OAuth + `/canva` router (`canva.routes.ts`, `backend/src/features/canva/`)
- [x] [M] Canva in Settings + `HomeCanvaStrip` on Home
- [x] [S] `npm run canva` → `@canva/cli` (root `package.json`)
- [x] [M] Cortex MCP HTTP server + tools (`backend/src/mcp/`, `docs/cortex-mcp.md`)
- [x] [M] `McpLinkPage` + Tailscale/local link prefs (`frontend/src/pages/McpLinkPage.tsx`)
- [ ] [M] MCP auth aligned with cloud user id (not only local demo user)
- [ ] [L] Hosted MCP endpoint story when API is cloud-only

---

## Progress Tracker

| Phase | Name | Done | Total | % |
|-------|------|------|-------|---|
| 0 | Unify + online data | 3 | 12 | 25% |
| 1 | Foundation | 13 | 15 | 87% |
| 2 | Shell Home | 9 | 13 | 69% |
| 3 | Gmail + Mail | 3 | 9 | 33% |
| 4 | Spotify | 4 | 10 | 40% |
| 5 | AI Assistant | 4 | 9 | 44% |
| 6 | Steam + Discord | 0 | 8 | 0% |
| 7 | Obsidian + Notion | 4 | 9 | 44% |
| 8 | Files + Automation | 1 | 7 | 14% |
| 9 | Settings | 4 | 9 | 44% |
| 10 | Performance | 1 | 8 | 13% |
| 11 | Teams | 0 | 5 | 0% |
| 12 | Link-first ship | 1 | 11 | 9% |
| 13 | M365 + Calendar | 4 | 6 | 67% |
| 14 | Canva + MCP | 5 | 7 | 71% |

**Totals:** 57 done, 85 remaining (**142** checklist lines; ≈ **40%** complete).

**Runway (rough):** At one checkbox per day, **~87 days** — Phase 0 + 12 are the critical path for “same data everywhere” and “share a link to install.”

Run `/goal` again anytime to re-verify checkboxes against the tree.

---

## Recommended next actions (ordered)

1. **Phase 0:** On each machine: set `FIREBASE_PROJECT_ID` + service account in `backend/.env`, then `npm run sync:env:pull`.
2. **Phase 0:** Commit or stash `main` WIP, then merge integrations hub **in slices** (billing/memory UI → settings API → tasks).
3. **Phase 12:** Pick production API host + publish `https://app…` and a GitHub Release with `npm run dist` artifact + short install README.
