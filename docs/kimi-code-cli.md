# Kimi Code CLI + Cortex

Use [Kimi Code CLI](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html) as a terminal coding agent on the Cortex repo. It reads files, edits code, runs shell commands, and can work alongside Cursor.

## Install (once per machine)

**Windows (recommended in this repo):**

```powershell
npm run kimi:install
```

**macOS / Linux / Git Bash:**

```bash
curl -L code.kimi.com/install.sh | bash
```

Both paths install [uv](https://docs.astral.sh/uv/) if needed, then:

```bash
uv tool install --python 3.13 kimi-cli
```

Ensure `%USERPROFILE%\.local\bin` (Windows) or `~/.local/bin` (Unix) is on your `PATH`.

Verify:

```powershell
npm run kimi:version
```

## Auth

**Option A — browser (interactive terminal):**

```powershell
npm run kimi:login
# or inside `npm run kimi`, type: /login
```

Choose **Kimi Code** (OAuth) or paste an API key from [kimi.com/code/console](https://www.kimi.com/code/console).

**Option B — API key (good for scripts + Cursor shells):**

1. Copy `.env.kimi.example` → `.env.kimi` (or add to `backend/.env`):

   ```
   KIMI_API_KEY=sk-...
   KIMI_MODEL_NAME=kimi-k2.6
   ```

2. `npm run kimi:task -- "your prompt"` — the launcher sets `KIMI_API_KEY` and defaults the model to **kimi-k2.6**.

If you see `LLM not set`, auth is missing — run `npm run kimi:login` or set `KIMI_API_KEY`.

Upgrade later:

```bash
uv tool upgrade kimi-cli --no-cache
```

## Run on Cortex

From repo root:

```powershell
npm run kimi
```

One-shot (CI-style, **Kimi K2.6**):

```powershell
npm run kimi:task -- List open tasks in frontend TasksCalendarPage

# Or pass flags through the launcher:
npm run kimi -- -p "Polish calendar week grid" -m kimi-k2.6 --quiet
```

Browser UI (good for long sessions):

```powershell
npm run kimi:web
```

Opens [http://127.0.0.1:5494](http://127.0.0.1:5494) by default.

## Cortex dev context

Kimi should follow the same contracts as other agents on this repo:

| Doc | Purpose |
|-----|---------|
| `AGENTS.md` | Skill routing (`/review`, `/investigate`, `/qa`, …) |
| `docs/dev-resources.md` | Lite vs full dev, RAM, `npm run db:migrate` |
| `docs/GOALS.md` | Current roadmap (Tasks & Calendar hub, etc.) |

Typical Cortex stack while developing:

```powershell
npm run dev          # API :4000 + Vite :5173
npm run open         # Chrome (not Cursor Simple Browser)
npm run kimi         # Kimi agent in another terminal
```

Demo login (dev): `grey@cortex.local` / `ChangeMe123!` / PIN `1234` — see `AGENTS.md`.

## npm scripts

| Script | Command |
|--------|---------|
| `npm run kimi:install` | Install or upgrade via `uv` |
| `npm run kimi` | Interactive Kimi in repo root |
| `npm run kimi:version` | `kimi info` smoke test |
| `npm run kimi:web` | `kimi web` (local UI) |
| `npm run kimi:task` | One-shot prompt (`kimi-k2.6`, `--quiet`) |
| `npm run kimi:login` | Browser OAuth setup |

## Windows notes

- Prefer **Windows Terminal** for interactive `kimi` (full TTY).
- Cursor agent shells may behave poorly with long interactive sessions; use `npm run kimi:web` or an external terminal.
- The bash install script is optional on Windows; `npm run kimi:install` is equivalent.
