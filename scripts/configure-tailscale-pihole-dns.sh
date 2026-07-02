#!/usr/bin/env bash
# Verify (and optionally align) Tailscale → Pi-hole DNS for .cortex names on all tailnet devices.
#
# Tailnet DNS is configured in the Tailscale admin console (not via this script alone).
# Recommended mode is SPLIT DNS: only the `cortex` domain is routed to Pi-hole, so
# regular internet DNS keeps working on every device even when this host is down.
# This script checks Pi-hole is listening on your Tailscale IP and that blocking works.
#
# Usage:
#   ./scripts/configure-tailscale-pihole-dns.sh          # verify only
#   ./scripts/configure-tailscale-pihole-dns.sh --sync   # update pihole .env IP + recreate container
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIHOLE_DIR="$ROOT/deploy/nas/pihole"
PIHOLE_ENV="$PIHOLE_DIR/.env"
SYNC=false
[[ "${1:-}" == "--sync" ]] && SYNC=true

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found — install Tailscale on this host first." >&2
  exit 1
fi

TS_IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
if [[ ! "$TS_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Tailscale is not connected (no 100.x.x.x address)." >&2
  exit 1
fi

echo "Tailscale IPv4: $TS_IP"
echo ""

# --- Pi-hole .env: keep PIHOLE_TAILSCALE_IP in sync ---
if [[ -f "$PIHOLE_ENV" ]]; then
  CURRENT_TS="$(grep -E '^PIHOLE_TAILSCALE_IP=' "$PIHOLE_ENV" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ "$CURRENT_TS" != "$TS_IP" ]]; then
    echo "Pi-hole .env PIHOLE_TAILSCALE_IP=$CURRENT_TS → $TS_IP"
    if [[ "$SYNC" == true ]]; then
      if grep -q '^PIHOLE_TAILSCALE_IP=' "$PIHOLE_ENV"; then
        sed -i "s|^PIHOLE_TAILSCALE_IP=.*|PIHOLE_TAILSCALE_IP=${TS_IP}|" "$PIHOLE_ENV"
      else
        echo "PIHOLE_TAILSCALE_IP=${TS_IP}" >>"$PIHOLE_ENV"
      fi
      echo "Recreating Pi-hole container..."
      (cd "$PIHOLE_DIR" && docker compose --env-file .env up -d)
    else
      echo "  Run: $0 --sync   (or edit deploy/nas/pihole/.env and docker compose up -d)"
    fi
  else
    echo "Pi-hole .env PIHOLE_TAILSCALE_IP matches Tailscale IP."
  fi
else
  echo "Missing $PIHOLE_ENV — run: cd deploy/nas/pihole && cp .env.example .env"
  exit 1
fi

# --- Pi-hole container ---
if ! docker ps --format '{{.Names}}' | grep -qE 'cortex-pihole|pihole'; then
  echo ""
  echo "Pi-hole is not running. Start it:"
  echo "  npm run nas:pihole:up"
  exit 1
fi

# --- Port 53 on Tailscale IP ---
if ! ss -ulnp 2>/dev/null | grep -q "${TS_IP}:53"; then
  echo ""
  echo "WARNING: nothing listening on ${TS_IP}:53 — Tailscale clients cannot use Pi-hole DNS."
  echo "  Check deploy/nas/pihole/docker-compose.yml and recreate: npm run nas:pihole:up"
  exit 1
fi
echo "DNS listening on ${TS_IP}:53 (UDP)."

# --- Blocking test ---
BLOCKED=""
if command -v dig >/dev/null 2>&1; then
  BLOCKED="$(dig +short +time=2 "@${TS_IP}" doubleclick.net A 2>/dev/null | head -1 || true)"
  if [[ "$BLOCKED" == "0.0.0.0" || "$BLOCKED" == "0.0.0.0." ]]; then
    echo "Ad domain test (doubleclick.net): blocked (0.0.0.0) — Pi-hole DNS OK."
  else
    echo "WARNING: doubleclick.net was not blocked (got: ${BLOCKED:-empty}). Check Pi-hole gravity/lists."
  fi
else
  echo "(install dig/bind9-dnsutils for ad-block smoke test)"
fi

# --- Tailscale DNS config (read-only) ---
echo ""
echo "=== Tailscale DNS (this device) ==="
if tailscale dns status 2>/dev/null | grep -q .; then
  tailscale dns status 2>/dev/null | sed -n '/Resolvers/,/^$/p' | head -8
  if tailscale dns status 2>/dev/null | grep -q "$TS_IP"; then
    echo ""
    echo "OK: Tailscale routes DNS to $TS_IP on this machine (global or split)."
  else
    echo ""
    echo "This device has no DNS route to $TS_IP yet."
    echo ""
    echo "Recommended tailnet DNS — SPLIT DNS (one-time, admin):"
    echo "  https://login.tailscale.com/admin/dns"
    echo "  1. Keep MagicDNS on"
    echo "  2. Nameservers → Add custom → $TS_IP → toggle 'Restrict to domain' → cortex"
    echo "     (only *.cortex lookups go to Pi-hole; everything else uses each"
    echo "      device's normal DNS, so the internet keeps working when this box is off)"
    echo "  3. Remove any GLOBAL custom nameserver pointing at $TS_IP and turn"
    echo "     'Override local DNS' OFF — global override makes ALL internet DNS on"
    echo "     every tailnet device depend on this host being reachable."
    echo ""
    echo "Optional alternative (tailnet-wide ad blocking, less resilient):"
    echo "  Global nameserver $TS_IP + fallback 1.1.1.1 + Override local DNS ON."
    echo "  Tradeoff: if Pi-hole/this host is down, devices lose ALL DNS while"
    echo "  Tailscale is connected (symptom: 'only Jellyfin works')."
    echo ""
    echo "On each phone/laptop: Tailscale app connected; DNS defaults to tailnet settings."
    echo "  Android: Settings → Network → Private DNS → Off."
    echo "  iPhone:"
    echo "    - Tailscale app: VPN on, Use Tailscale DNS enabled"
    echo "    - Settings → Apple ID → iCloud → Private Relay OFF (testing)"
    echo "    - Settings → Wi‑Fi → (i) → Configure DNS → Automatic"
    echo "    - Safari → Hide IP Address → off (testing)"
    echo "    - In-app ads (YouTube, Twitch app, Instagram) often ignore DNS — expected"
    echo "    - Twitch in browser: Pi-hole + uBlock (see deploy/nas/pihole/README.md#twitch-ads-tailscale--pi-hole)"
  fi
else
  echo "Run: tailscale set --accept-dns=true  (default on most installs)"
  echo "Admin DNS: https://login.tailscale.com/admin/dns → nameserver $TS_IP"
fi

# --- Homelab API env (optional hint) ---
API_ENV="$ROOT/deploy/homelab/env/api.env"
if [[ -f "$API_ENV" ]]; then
  if ! grep -q '^HOMELAB_PIHOLE_API_PASSWORD=' "$API_ENV" 2>/dev/null; then
    echo ""
    echo "Homelab UI: set HOMELAB_PIHOLE_API_PASSWORD in deploy/homelab/env/api.env (same as PIHOLE_WEBPASSWORD)."
  fi
  if grep -q '^HOMELAB_PIHOLE_URL=' "$API_ENV" 2>/dev/null; then
    :
  else
    echo ""
    echo "Homelab API: add HOMELAB_PIHOLE_URL=http://${TS_IP}:8090 to deploy/homelab/env/api.env"
  fi
fi

echo ""
echo "Pi-hole admin: http://${TS_IP}:8090/admin/"
echo "Done."
