# Cortex agent goal — Google Workspace polish

Use this during **Polish** ticks in `/loop` (`npm run loop`). One visible improvement per wake; stop when the slice is shippable.

---

## North star

Cortex should feel like **Google Calendar / Tasks / Drive**: calm white (or dark) surfaces, hairline borders, predictable spacing, inline controls, and zero “dev tool” rough edges.

Existing code to extend (do not reinvent):

| Surface | Reference |
|---------|-----------|
| Global shell | `styles-notion-app.css`, `styles-google-workspace.css` (`html.cortex-notion`) |
| Tasks / Calendar | `styles-productivity.css`, `styles-tasks-cal.css` |
| Home canvas | `styles-canvas.css`, inline inspector in `CanvasWidgetInspectorInline.tsx` |
| Design tokens | `DESIGN.md` |

---

## Polish checklist (pick ONE per tick)

### P0 — Home canvas

- [ ] **At a glance** renders on board + composer preview; homelab quick status never crashes widget
- [ ] Add widget → refresh → layout persists (`PreferencesContext` / canvas nodes)
- [ ] Board **Size** + **Scale** affect widget body only; toolbar stays fixed 13px
- [ ] Widget click: selection + inline inspector; resize grip easy to hit
- [ ] Single **+ Add** path; library closes after insert

### P1 — App chrome

- [ ] Top nav: active state, hover, 36px row height (`app-topnav`)
- [ ] Command palette: focus ring, result highlight, Esc to close
- [ ] Settings → Integrations: card grid, primary connect CTA hierarchy
- [ ] Login + PIN gate: centered card, clear error copy

### P2 — Productivity

- [ ] Tasks list row density + checkbox alignment (Google Tasks)
- [ ] Calendar grid today column + event chips
- [ ] Mail thread list preview line + unread state
- [ ] Goals tab on Tasks: empty state + progress bar polish

### P3 — Widgets & data

- [ ] Homelab / Media status widgets: loading skeletons, not spinners only
- [ ] Spotify stats dashboard spacing pass
- [ ] AI page: suggestion chips + workspace rail alignment

---

## Constraints

- No Firestore merge, billing, or large refactors in Polish ticks.
- No commits unless user asked.
- Max ~5 files per tick; run `npm run typecheck` if frontend changed.
- Deploy after API/web: `npm run server:deploy`.

---

## Done when (per tick)

- One checklist item above is visibly better in Chrome at `:8080` or `:5173`.
- No new typecheck errors.
- If canvas/widget: error boundary contains failures; console clean for happy path.

---

## Verify

```bash
cd frontend && npm run typecheck
```

Manual: hard refresh (`Ctrl+Shift+R`), exercise the slice you touched.
