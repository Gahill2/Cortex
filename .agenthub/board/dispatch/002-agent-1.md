---
author: coordinator
timestamp: 2026-05-15T12:00:01Z
channel: dispatch
parent: 001-coordinator-brief.md
---

# Agent 1 — Deep local vault + live index

**Strategy:** Local-first excellence. Make Obsidian the primary knowledge surface.

**Tasks:**
1. Upgrade `backend/src/features/obsidian/vault-index.ts` — cache index to disk (`.cortex/vault-index.json`), optional chokidar watcher to refresh on file changes
2. Add `GET /api/memory/vaults/reindex` and expose reindex in Memory UI
3. Parse YAML frontmatter for tags/aliases in search snippets
4. Add Home page **Memory widget** (status + quick search) linking to Memory tab
5. Open note path via `obsidian://` URI helper from search results (frontend)

**Constraints:** No new npm deps unless justified. Match existing Cortex patterns.

**Result file:** `.agenthub/board/results/agent-1-result.md`
