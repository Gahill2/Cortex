# Anthropic skills library (vendored)

Cortex includes [anthropics/skills](https://github.com/anthropics/skills) as a git submodule at `vendor/anthropic-skills` (official document, design, and workflow skills from Anthropic).

## First-time setup

```powershell
git submodule update --init vendor/anthropic-skills
.\scripts\sync-anthropic-skills.ps1
```

Or:

```powershell
npm run sync:anthropic-skills
```

Skills are copied into `.cursor/skills/anthropic-<skill-name>/` (prefixed to avoid collisions with other vendored libraries). Project skills **`design`**, **`goal`**, and **`lazyweb`** are never overwritten.

## Update to latest upstream

```powershell
cd vendor/anthropic-skills
git pull origin main
cd ../..
.\scripts\sync-anthropic-skills.ps1
```

## Using skills in Cursor

In chat, reference a skill with `@anthropic-pdf`, `@anthropic-frontend-design`, `@anthropic-mcp-builder`, etc.

See upstream [README](https://github.com/anthropics/skills) for the full skill list and spec.

## Note on `.gitignore`

`.cursor/` is gitignored locally; synced skills live on disk after you run the script. The submodule pin in git is the source of truth for versions.
