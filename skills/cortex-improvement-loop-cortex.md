# Cortex continuous improvement loop (skill)

Timer emits `AGENT_LOOP_WAKE_cortex_improve` every 2m; **this Cursor chat** executes each phase (Build → Verify → Polish → Observe).

## Start in chat

1. Kill old loops: `pkill -f cortex-improvement-loop.sh`
2. Start **monitored** shell: `npm run dev:improve-loop` with `notify_on_output` on `AGENT_LOOP_WAKE_cortex_improve`
3. On each wake: read JSON prompt, run that phase, edit repo + `docs/cortex-dev-loop.md`

## Phases

| Phase | Action |
|-------|--------|
| **build** | First unchecked backlog item |
| **verify** | typecheck + lint + docker doctor + health |
| **polish** | One UI slice from DESIGN.md / production UI goals |
| **observe** | Backlog hygiene, task-observer notes |

## Rules

- No commits unless user asked
- `npm run server:deploy` after API/web changes (no sudo docker)
- Default: chat mode (`CORTEX_IMPROVE_EXEC=0`)

## Status / stop

```bash
npm run dev:improve:status
pkill -f cortex-improvement-loop.sh
```
