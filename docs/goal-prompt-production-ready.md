# Cortex agent goal — production shell + Mail UX

Use this as a single `/goal` or task prompt. Each section maps to the 9-part template for lower token waste and clearer stop conditions.

---

## 1. Goal

Make Cortex’s **default user-facing shell production-ready**: transparent branding everywhere, polished Mail inbox UX, and a verified `npm run dev` / `npm run typecheck` path with no regressions on Home, auth, or PIN.

---

## 2. Context

- **Home** on `main` uses `HomeProduction` (fixed bento), not the legacy drag grid.
- **Branding** just shipped: `cortex-icon-transparent.svg` + `cortex-logo-transparent.svg`; legacy PNGs may still exist under `frontend/src/assets/`.
- **Auth** uses `cortex_token`, `SessionPinGate`, OTP/PIN; demo PIN often `1234` in `backend/.env` (`CORTEX_DEMO_USER_PIN`).
- **Mail** still has rough UX: emoji/symbol sidebar chrome, weak list/preview spacing; partial crash guard on `MailPage` only.
- **Design source of truth:** `DESIGN.md` (dark glass, Plus Jakarta, `#5b8dff` → `#3be8ad`, 8px spacing).
- **Agentmemory** skills live at `.cursor/skills/agentmemory-*` after `npm run sync:agentmemory-skills`; memory server via `npm run dev:memory` or `dev:stack`.
- **North star** (long roadmap): `docs/GOALS.md` Phase 0 (Firestore) + Phase 12 (link-first ship) — **out of scope** for this goal unless a blocker appears.

---

## 3. Constraints

- Do **not** change Firestore merge, billing, or `feat/firebase-dashboard-integrations` unless required to run tests.
- Do **not** reintroduce white/chip backgrounds behind logos; use transparent SVG assets only.
- Do **not** rewrite `HomePage` back to `@dnd-kit` grid.
- Do **not** commit secrets, `dev.db`, or log files.
- Do **not** create git commits unless the user explicitly asks.
- Prefer **Lucide** icons over emoji/Unicode symbols in Mail and shell chrome.
- Match existing patterns in `CortexBrand`, `styles-*.css`, and `frontend/src/api/client.ts` — no drive-by refactors.

---

## 4. Priority

1. **Mail page** — layout, typography, icons, list/detail spacing (`MailPage.tsx`, `styles-mail.css`).
2. **Brand consistency** — grep for `cortex-logo.png`, `cortex-favicon.png`, chip hacks; point all UI to transparent SVGs.
3. **Auth + loading** — quick visual pass on `LoginPage`, `SessionPinGate`, `PageLoading` (already updated; fix any stragglers).
4. **Home bento** — overflow/spacing only if broken after Mail changes (`styles-home-prod.css`, widgets).
5. **Cleanup** — remove unused legacy PNGs only if nothing references them (optional, last).

---

## 5. Plan

1. Read `DESIGN.md`, `MailPage.tsx`, `styles-mail.css`, and `CortexBrand` / `assets.ts`.
2. Replace Mail sidebar/toolbar emoji and special characters with Lucide; align spacing to design tokens.
3. Improve thread list + reading pane hierarchy (subject, preview, meta, empty/error states).
4. Grep repo for old logo paths and favicon chip CSS; fix references.
5. Run `npm run typecheck` in `frontend`; run targeted backend tests if Mail API types change.
6. Smoke: note manual checks for PIN login, Home widgets, Mail list load (no full QA skill unless asked).

---

## 6. Done when

- Mail UI uses **no emoji** as primary navigation/icons; layout matches `DESIGN.md` spacing and type scale.
- All in-app branding uses **transparent SVG** marks (no white boxes on dark glass).
- `npm run typecheck` in `frontend` exits **0**.
- No new TypeScript or obvious runtime errors introduced in touched files.

---

## 7. Verify

```powershell
cd frontend
npm run typecheck
```

```powershell
cd backend
npm test
```

Manual (document results in final message):

- `npm run dev` → open app (Vite may be **5174** if 5173 is busy); PIN unlock succeeds.
- Home loads bento; Mail page opens without console errors; thread list readable on desktop width.

---

## 8. Output

Return a short report with:

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
- **Files changed** (grouped: Mail, brand, styles, other)
- **Before/after** for Mail (1–2 sentences, no screenshot required)
- **Verify:** typecheck + test command results
- **Follow-ups:** anything deferred (Firestore merge, scrape-inspired Mail v2, Electron icon from SVG)

---

## 9. Stop rules

- Stop after **25** tool turns on this goal and summarize partial work + blockers.
- Stop if the **same test or typecheck error** fails **3** times without a new hypothesis — report root cause guess.
- Stop and ask the user if Mail requires **live Gmail/Microsoft OAuth** not configured locally (cannot verify inbox without credentials).
- Stop before starting Phase 0 Firestore merge, hosted deploy, or `/design-shotgun` logo exploration — out of scope unless user expands goal.
