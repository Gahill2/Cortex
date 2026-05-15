# Claude Skills library (vendored)

Cortex includes [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) as a git submodule at `vendor/claude-skills` (268+ agent skills: engineering, product, marketing, compliance, C-level, and more).

## First-time setup

```powershell
git submodule update --init --recursive
.\scripts\sync-claude-skills.ps1
```

Skills are copied into `.cursor/skills/<skill-name>/` (Cursor native format). Project skills **`design`** and **`goal`** are never overwritten.

## Update to latest upstream

```powershell
cd vendor/claude-skills
git pull origin main
cd ../..
.\scripts\sync-claude-skills.ps1
```

## Using skills in Cursor

In chat, reference a skill with `@senior-architect`, `@content-creator`, etc., or describe the task and let the agent pick a matching skill from the description.

See upstream [README](https://github.com/alirezarezvani/claude-skills) for domains, Python CLI tools, and bundles.

## Note on `.gitignore`

`.cursor/` is gitignored locally; synced skills live on disk after you run the script. The submodule pin in git is the source of truth for versions.
