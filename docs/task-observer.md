# Task Observer (One Skill to Rule Them All)

Cortex integrates [rebelytics/one-skill-to-rule-them-all](https://github.com/rebelytics/one-skill-to-rule-them-all) — a meta-skill that watches your work sessions, logs skill improvement opportunities, and drives recurring skill reviews. Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) by Eoghan Henn / [rebelytics.com](https://www.rebelytics.com/task-observer/).

## Install

```bash
git submodule update --init vendor/task-observer
npm run sync:task-observer
```

On Windows PowerShell: `npm run sync:task-observer` (same script, `.ps1` wrapper).

This copies the upstream skill into `.cursor/skills/task-observer/` plus a Cortex-specific `CORTEX-WORKSPACE.md` appendix (paths, Cursor substitutions, homelab notes).

## Use in Cursor

1. **Automatic** — `AGENTS.md` / `CLAUDE.md` instruct the agent to invoke `@task-observer` at the start of task-oriented sessions.
2. **Manual** — Reference `@task-observer` or say *"One skill to rule them all"* / *"log skill observations"*.
3. **Session end** — Ask: *"Any observations logged?"* (recommended by the upstream author).

## Where data lives

| Path | Purpose |
|------|---------|
| `skill-observations/log.md` | Running observation log |
| `skill-observations/cross-cutting-principles.md` | Rules that apply to all skills |
| `skill-observations/archive/` | Resolved observations (auto-archived) |
| `skill-updates/` | Staged skill edits awaiting your review |

Observation logs may contain internal project notes — they are gitignored by default (see `.gitignore`).

## Review cadence

Upstream recommends a recurring review (e.g. Mon/Wed/Fri) to apply OPEN observations to your skills. In Cursor you can:

- Run a dedicated chat: *"Run the task-observer comprehensive review"*
- Use the [loop skill](https://github.com/rebelytics/one-skill-to-rule-them-all) pattern / local cron on the homelab PC

If no review ran in 7+ days, the skill triggers an in-session fallback review at the next task start.

## Update upstream

```bash
cd vendor/task-observer && git pull && cd ../..
npm run sync:task-observer
```

## Further reading

- Upstream README: https://github.com/rebelytics/one-skill-to-rule-them-all
- USER-GUIDE (in repo after sync): `.cursor/skills/task-observer/USER-GUIDE.md`
- Cortex paths: `skills/task-observer-cortex.md` → synced as `CORTEX-WORKSPACE.md`
