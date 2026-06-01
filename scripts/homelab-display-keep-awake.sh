#!/usr/bin/env bash
# Keep the homelab display awake (GNOME/Wayland + power profile). Run on the cortex PC after login.
set -euo pipefail

echo "=== Cortex homelab: keep display awake ==="

if command -v powerprofilesctl >/dev/null 2>&1; then
  powerprofilesctl set balanced 2>/dev/null || powerprofilesctl set performance 2>/dev/null || true
  echo "Power profile: $(powerprofilesctl get 2>/dev/null || echo unknown)"
fi

if command -v gsettings >/dev/null 2>&1; then
  # Never blank screen from session idle
  gsettings set org.gnome.desktop.session idle-delay 0
  gsettings set org.gnome.settings-daemon.plugins.power idle-dim false
  # Do not suspend on idle (AC or battery)
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-timeout 0
  # No lock screen / screensaver from idle
  gsettings set org.gnome.desktop.screensaver idle-activation-enabled false
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true
  # Cinnamon (if installed alongside GNOME tools)
  gsettings set org.cinnamon.desktop.screensaver idle-activation-enabled false 2>/dev/null || true
  gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0 2>/dev/null || true
  gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0 2>/dev/null || true
  echo "GNOME idle-delay: $(gsettings get org.gnome.desktop.session idle-delay)"
  echo "GNOME idle-dim: $(gsettings get org.gnome.settings-daemon.plugins.power idle-dim)"
  echo "GNOME suspend on AC: $(gsettings get org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type)"
fi

# X11 fallback (optional local session)
if command -v xset >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  xset s off 2>/dev/null || true
  xset -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
  echo "xset: disabled screen saver / DPMS (if supported)"
fi

echo ""
echo "Done. Display should stay on. Re-run after OS updates if blanking returns."
echo "To undo: Settings → Power, or set idle-delay back (e.g. gsettings set org.gnome.desktop.session idle-delay 900)"
