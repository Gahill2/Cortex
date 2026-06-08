#!/usr/bin/env bash
# Ubuntu/Linux maintenance for the Cortex homelab host.
# Run from a normal terminal (Ctrl+Alt+T), not only Cursor's embedded shell:
#   cd ~/Documents/Cortex && npm run linux:maintenance
#
# Prompts for sudo once. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[linux-maintenance] $*"; }
warn() { echo "[linux-maintenance] WARN: $*" >&2; }

need_sudo() {
  if ! sudo -v; then
    warn "sudo required — open a normal terminal (Ctrl+Alt+T) and run again."
    exit 1
  fi
}

log "=== Cortex Linux maintenance ==="
log "Host: $(hostname) — $(lsb_release -ds 2>/dev/null || uname -sr)"

need_sudo

log "1/7 — apt update"
sudo apt-get update -qq

UPGRADABLE="$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')"
log "2/7 — apt upgrade ($UPGRADABLE packages)"
if [[ "$UPGRADABLE" != "0" ]]; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
else
  log "   already up to date"
fi

log "3/7 — apt autoremove + clean"
sudo apt-get autoremove -y -qq
sudo apt-get autoclean -y -qq

log "4/7 — refresh snaps + restart snapd"
if command -v snap >/dev/null 2>&1; then
  sudo snap refresh 2>/dev/null || warn "snap refresh failed (non-fatal)"
  sudo systemctl restart snapd snapd.apparmor snapd.seeded 2>/dev/null || true
  sleep 2
else
  warn "snap not installed"
fi

log "5/7 — Tailscale update (if installed)"
if command -v tailscale >/dev/null 2>&1; then
  if apt list --upgradable 2>/dev/null | grep -q '^tailscale/'; then
    sudo apt-get install -y tailscale
  fi
  tailscale version 2>/dev/null | head -1 || true
  tailscale status --json 2>/dev/null | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  self=d.get('Self',{})
  print('   tailscale:', self.get('Online'), self.get('DNSName',''))
except Exception:
  pass
" 2>/dev/null || tailscale status 2>/dev/null | head -3 || true
else
  log "   tailscale not installed — skip"
fi

log "6/7 — Docker + homelab doctor"
if command -v docker >/dev/null 2>&1; then
  bash "$ROOT/scripts/docker-daemon-fix.sh" || warn "docker daemon fix failed"
  bash "$ROOT/scripts/homelab-docker-doctor.sh" || warn "homelab docker doctor reported issues"
else
  warn "docker not in PATH"
fi

log "7/7 — desktop apps + user services"
CHROME_OK=0
DISCORD_OK=0
FIREFOX_OK=0

if command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1; then
  CHROME_OK=1
  log "   ✓ Google Chrome ($(google-chrome --version 2>/dev/null || google-chrome-stable --version 2>/dev/null))"
else
  warn "Google Chrome missing — install: wget -qO- https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list && sudo apt update && sudo apt install -y google-chrome-stable"
fi

if command -v discord >/dev/null 2>&1; then
  if discord --version >/dev/null 2>&1; then
    DISCORD_OK=1
    log "   ✓ Discord snap launches from this shell"
  else
    warn "Discord snap installed but fails from this terminal (normal in Cursor)."
    log "   → Open Discord: Super key → type Discord → Enter"
    log "   → Or use Chrome: https://discord.com/app"
  fi
fi

if command -v firefox >/dev/null 2>&1; then
  if firefox --version >/dev/null 2>&1; then
    FIREFOX_OK=1
    log "   ✓ Firefox snap launches from this shell"
  else
    warn "Firefox snap fails from embedded terminals — use Chrome for Cortex dev (npm run open)."
  fi
fi

for svc in cortex-agentmemory.service cortex-wpp-discord-bot.service; do
  if systemctl --user is-enabled "$svc" >/dev/null 2>&1; then
    state="$(systemctl --user is-active "$svc" 2>/dev/null || echo inactive)"
    if [[ "$state" == "active" ]]; then
      log "   ✓ $svc ($state)"
    else
      warn "$svc is $state — try: systemctl --user restart $svc"
    fi
  fi
done

if curl -sf http://127.0.0.1:4000/health >/dev/null 2>&1; then
  log "   ✓ Cortex API health OK (localhost:4000)"
elif curl -sf http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
  log "   ✓ Cortex API health OK (localhost:8080)"
else
  warn "Cortex API not responding — try: cd deploy/homelab && docker compose up -d cortex-api cortex-web"
fi

log ""
log "=== Done ==="
log "Cortex dev: npm run dev  then  npm run open  (Chrome — not Firefox snap)"
log "Homelab UI: http://127.0.0.1:8080"
log "Docs: docs/linux-desktop-setup.md"

if [[ "$CHROME_OK" -eq 0 ]]; then
  exit 1
fi
