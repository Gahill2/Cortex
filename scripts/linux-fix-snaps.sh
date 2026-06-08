#!/usr/bin/env bash
# Fix snap apps (Discord, Firefox, etc.) when snap-confine refuses to run.
# Symptom: "snap-confine has elevated permissions and is not confined but should be"
#
# Run from a normal terminal (Ctrl+Alt+T):
#   cd ~/Documents/Cortex && npm run linux:fix-snaps
#
# Optional: install Discord .deb (bypasses snap) — add --install-discord-deb
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DISCORD_DEB=0
if [[ "${1:-}" == "--install-discord-deb" ]]; then
  INSTALL_DISCORD_DEB=1
fi

log() { echo "[linux-fix-snaps] $*"; }
warn() { echo "[linux-fix-snaps] WARN: $*" >&2; }

if ! sudo -v; then
  warn "sudo required — run from Ctrl+Alt+T, not only Cursor's terminal."
  exit 1
fi

log "=== Fix Snap / AppArmor (Discord, Firefox, …) ==="

log "1/6 — upgrade snapd (apt was behind snap snapd)"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y snapd

log "2/6 — ensure AppArmor services enabled"
sudo systemctl enable --now apparmor.service
sudo systemctl enable --now snapd.apparmor.service

log "3/6 — reload snap-confine AppArmor profiles"
for f in /etc/apparmor.d/*snap-confine* /var/lib/snapd/apparmor/profiles/snap-confine*; do
  [[ -e "$f" ]] || continue
  sudo apparmor_parser -r "$f" 2>/dev/null || warn "could not parse $f"
done

log "4/6 — restart snapd stack"
sudo systemctl restart snapd snapd.apparmor apparmor
sleep 2
sudo snap refresh 2>/dev/null || warn "snap refresh failed (non-fatal)"

log "5/6 — test snap launch"
if discord --version >/dev/null 2>&1 || timeout 8 discord --version 2>/dev/null; then
  log "   ✓ Discord snap launches"
elif firefox --version >/dev/null 2>&1; then
  log "   ✓ Firefox snap launches (Discord not tested)"
else
  warn "Snap apps still failing after AppArmor reload."
  if [[ "$INSTALL_DISCORD_DEB" -eq 1 ]]; then
    log "6/6 — installing Discord .deb (non-snap)"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    curl -fsSL -o "$TMP/discord.deb" "https://discord.com/api/download?platform=linux&format=deb"
    sudo apt-get install -y "$TMP/discord.deb"
    log "   ✓ Discord .deb installed — launch from app menu as 'Discord' (deb)"
  else
    log ""
    log "Re-run with --install-discord-deb to install Discord outside Snap:"
    log "  npm run linux:fix-snaps -- --install-discord-deb"
    log ""
    log "Or use Discord in Chrome: https://discord.com/app"
    exit 1
  fi
fi

log ""
log "=== Done ==="
log "Try Discord: Super key → Discord"
log "If it still fails: npm run linux:fix-snaps -- --install-discord-deb"
