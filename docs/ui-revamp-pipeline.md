# UI revamp pipeline (OpenClaw + Kimi + Claude + Pi)

Orchestrate a **full frontend revamp** using three coding agents plus OpenClaw as coordinator.

| Agent | Role | How to run |
|-------|------|------------|
| **Kimi** | Fast layout/CSS passes on page batches | `npm run revamp:ui:kimi -- -Batch 1` |
| **Claude** | Polish, hierarchy, complex pages (via OpenClaw + Claude Code Pro) | `npm run revamp:ui:claude -- -Batch 3` |
| **Pi** | Cross-page consistency review + typecheck fixes | `npm run revamp:ui:pi` |
| **OpenClaw TUI** | Interactive coordinator — run shell, chain agents, iterate | `npm run openclaw:revamp` |

Shared design rules: [prompts/ui-revamp/AGENT-BRIEF.md](../prompts/ui-revamp/AGENT-BRIEF.md)

## Prerequisites

```powershell
cd C:\Users\greyh\Documents\GitHub\Cortex
npm run openclaw:setup
npm run kimi:login          # or keys in backend/.env
claude auth login           # for Claude / openclaw:claude:*
npm run pi:install          # once
```

## Batches

| Batch | Pages | Suggested agent |
|-------|--------|-----------------|
| **1** | Dashboard, Home, Projects, Settings | Kimi |
| **2** | Login, AI, Memory, MCP Link | Kimi |
| **3** | Mail, Notes, Tasks, Spotify + `styles.css` | Claude (polish after Kimi) |

Mail / Notes / Tasks already have a first SaaS pass; batch 3 is refinement.

## Recommended order

```powershell
npm run revamp:ui:kimi -- -Batch 1
npm run revamp:ui:kimi -- -Batch 2
npm run revamp:ui:claude -- -Batch 3
npm run revamp:ui:pi
```

View changes in Chrome: `npm run dev` → http://localhost:5173

## OpenClaw as coordinator

Start the TUI and paste this (or adapt per batch):

```
You are the Cortex UI revamp coordinator. Read prompts/ui-revamp/AGENT-BRIEF.md.

Run these in order, wait for each to finish, then summarize diffs:
1. npm run revamp:ui:kimi -- -Batch 1
2. npm run revamp:ui:kimi -- -Batch 2
3. npm run revamp:ui:claude -- -Batch 3
4. npm run revamp:ui:pi

After each step, run git diff --stat frontend/src/pages. Fix merge conflicts if any.
Do not touch backend/.env or deploy secrets.
```

Use **`npm run openclaw:revamp`** to open the Kimi-backed TUI with the plan printed first.

For Claude-driven OpenClaw sessions: **`npm run openclaw:claude`** instead of `openclaw:dev`.

## One-shot (no TUI)

```powershell
npm run revamp:ui              # print plan
npm run revamp:ui:kimi -- -Batch 1 -DryRun   # preview (script supports -DryRun)
```

## Notes

- Kimi OpenClaw default: `npm run openclaw:dev` (keys from `backend/.env`).
- Claude OpenClaw unsets `ANTHROPIC_API_KEY` so Pro login wins — see [openclaw-cortex.md](./openclaw-cortex.md).
- Pi one-shots need edit tools for fixes: `revamp:ui:pi` enables `read,edit,bash,grep,find`.
- Heavy pages (Tasks): test in **Chrome**, not Cursor Simple Browser.
