# Cortex UI revamp — agent brief

Apply **professional SaaS** spacing and structure across frontend pages. Match the patterns already on Mail, Notes, and Tasks & Calendar.

## Design contract

1. **Page shell**
   - `page-titlebar` → `h1` + optional `page-subtitle` (13px secondary line)
   - Main content in `page-workbench` (bordered card, `--radius-lg`, subtle shadow)
   - Page gutter: `--space-6` / `--space-8` (24–32px)

2. **Tokens** (from `frontend/src/styles.css`)
   - Spacing: `--space-1` … `--space-8`
   - Surfaces: `--surface`, `--border`, `--text`, `--text-2`
   - Do not invent new color systems

3. **Reference pages** (copy structure, not duplicate CSS blindly)
   - `frontend/src/pages/MailPage.tsx`
   - `frontend/src/pages/NotesPage.tsx`
   - `frontend/src/pages/TasksCalendarPage.tsx`

4. **Toolbar / lists**
   - One clear actions row under the title when filters or buttons exist
   - List rows: uniform padding (`--space-3` / `--space-4`), hover via `--surface-2`
   - Empty and loading states centered in the workbench

5. **Quality bar**
   - Run `npm run typecheck` in `frontend/` before finishing
   - Do not change backend or unrelated pages in your batch
   - Keep diffs focused; no drive-by refactors

## Your batch

See the phase prompt — only edit files listed for your agent and batch.
