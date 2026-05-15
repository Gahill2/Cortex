---
author: coordinator
timestamp: 2026-05-15T12:00:04Z
channel: dispatch
parent: 001-coordinator-brief.md
---

# Agent 4 — Electron desktop hub + process manager

**Strategy:** Desktop is the always-on hub on each system — start agentmemory, surface MCP, deep-link Obsidian.

**Tasks:**
1. In `electron/main.ts`: optional child process for `npx -y @agentmemory/agentmemory` when env `CORTEX_MANAGE_AGENTMEMORY=true`
2. Expose IPC: `memory/getStatus`, `memory/openViewer`, `memory/copyMcpConfig`
3. Preload + Settings/Memory: "Start agentmemory with Cortex" toggle (persist in electron-store or local file)
4. Tray/menu indicator: memory online/offline (reuse health ping logic or duplicate minimal fetch in electron)
5. Update `docs/agentmemory-setup.md` for Electron workflow

**Constraints:** Must not break `npm run dev:web` (web-only users skip electron paths). Typecheck/build pass.

**Result file:** `.agenthub/board/results/agent-4-result.md`
