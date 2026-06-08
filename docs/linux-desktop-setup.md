# Linux desktop setup (Cortex homelab host)

Ubuntu **26.04** on the **cortex** machine: updates, browsers, Snap quirks, and monthly maintenance.

## Quick maintenance (monthly)

From a **normal terminal** (Ctrl+Alt+T), not only Cursor’s embedded shell:

```bash
cd ~/Documents/Cortex
npm run linux:maintenance
```

Enter your password when `sudo` asks. The script:

- `apt update` + `upgrade` + `autoremove`
- `snap refresh` + restarts `snapd`
- Upgrades Tailscale if a package update exists
- Runs Docker daemon + homelab doctor
- Checks Chrome, Discord, user systemd services, API health

## Browsers — what works where

| App | Type | From Cursor terminal | From app menu / Ctrl+Alt+T |
|-----|------|----------------------|----------------------------|
| **Google Chrome** | `.deb` | ✓ Works | ✓ Works |
| **Firefox** | Snap | ✗ snap-confine error | ✓ Usually works |
| **Discord** | Snap | ✗ snap-confine error | ✓ Usually works |

**For Cortex development**, use **Chrome**:

```bash
npm run dev
npm run open    # opens Vite in Google Chrome
```

Do **not** use Cursor’s Simple Browser on heavy pages — it can freeze the IDE. See [dev-resources.md](./dev-resources.md).

### Why Discord / Firefox won’t open (Snap + AppArmor)

If Discord fails **even from the app menu** (Super key → Discord), Snap’s `snap-confine` AppArmor profile is broken — not a Cursor-only issue.

```text
snap-confine has elevated permissions and is not confined but should be.
```

**Fix (run once in Ctrl+Alt+T):**

```bash
cd ~/Documents/Cortex
npm run linux:fix-snaps
```

If Snap still fails after that:

```bash
npm run linux:fix-snaps -- --install-discord-deb
```

That installs Discord as a normal `.deb` (no Snap). **Or** use https://discord.com/app in Chrome.

Cursor’s terminal has the same Snap restriction — use Chrome (`npm run open`) for dev links.

### Open links from Cortex Settings

Integration wizards use **“Open developer console”**. If nothing opens:

1. Copy the redirect URL / console link from the page
2. Paste into Chrome (from app menu or `npm run open` after dev is up)

## Installed stack (reference)

| Tool | Notes |
|------|--------|
| Node | via `nvm` — `node -v` |
| Docker | user in `docker` group — never `sudo docker` for homelab |
| Tailscale | `tailscale status` |
| Cortex homelab | `deploy/homelab` — `docker compose ps` |
| Discord bot | `systemctl --user status cortex-wpp-discord-bot.service` |
| Agentmemory | `systemctl --user status cortex-agentmemory.service` |

## Common fixes

### Package updates only

```bash
sudo apt update && sudo apt upgrade -y
sudo snap refresh
```

### Docker socket missing

```bash
npm run server:docker:daemon-fix
```

### Stuck homelab containers

```bash
npm run server:docker:fix-once
```

### Discord bot down

```bash
systemctl --user restart cortex-wpp-discord-bot.service
journalctl --user -u cortex-wpp-discord-bot.service -n 30 --no-pager
```

### Install Google Chrome (if missing)

```bash
wget -qO- https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update && sudo apt install -y google-chrome-stable
```

## Cursor updates

Cursor itself upgrades via its own channel (`apt` may list `cursor` as upgradable). Accept updates from Cursor’s UI or:

```bash
sudo apt install --only-upgrade cursor
```
