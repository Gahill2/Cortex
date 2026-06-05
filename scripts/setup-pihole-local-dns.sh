#!/usr/bin/env bash
# Pi-hole local DNS: friendly names for homelab services (jellyfin.cortex, radarr.cortex, …).
# Pi-hole v6 stores these in /etc/pihole/pihole.toml → [dns] hosts = [...]
#
#   npm run nas:pihole:local-dns
#   npm run nas:pihole:local-dns -- --domain homelab
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIHOLE_ENV="$ROOT/deploy/nas/pihole/.env"
DOMAIN="${CORTEX_DNS_DOMAIN:-cortex}"
TARGET="${PIHOLE_DNS_TARGET:-tailscale}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain=*) DOMAIN="${1#*=}"; shift ;;
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --target=*) TARGET="${1#*=}"; shift ;;
    --target) TARGET="${2:?}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--domain cortex] [--target tailscale|lan|IP]"
      exit 0
      ;;
    *) shift ;;
  esac
done

log() { echo "[pihole-dns] $*"; }

NAS_ROOT="/mnt/cortex/nas-data"
LAN_IP=""
TS_IP=""
if [[ -f "$PIHOLE_ENV" ]]; then
  NAS_ROOT="$(grep -E '^NAS_DATA_ROOT=' "$PIHOLE_ENV" | cut -d= -f2- | tr -d '"' || true)"
  LAN_IP="$(grep -E '^PIHOLE_LOCAL_IP=' "$PIHOLE_ENV" | cut -d= -f2- | tr -d '"' || true)"
  TS_IP="$(grep -E '^PIHOLE_TAILSCALE_IP=' "$PIHOLE_ENV" | cut -d= -f2- | tr -d '"' || true)"
fi
NAS_ROOT="${NAS_DATA_ROOT:-$NAS_ROOT}"

if command -v tailscale >/dev/null 2>&1; then
  LIVE_TS="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
  [[ -n "${LIVE_TS:-}" ]] && TS_IP="$LIVE_TS"
fi

case "$TARGET" in
  lan) IP="${LAN_IP}" ;;
  tailscale) IP="${TS_IP}" ;;
  *)
    if [[ "$TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      IP="$TARGET"
    else
      IP="${TS_IP:-$LAN_IP}"
    fi
    ;;
esac

if [[ -z "${IP:-}" ]]; then
  echo "No target IP. Set PIHOLE_TAILSCALE_IP in deploy/nas/pihole/.env or pass --target=100.x.x.x" >&2
  exit 1
fi

PIHOLE_ETC="${NAS_ROOT}/appdata/pihole/etc-pihole"
TOML="${PIHOLE_ETC}/pihole.toml"
if [[ ! -f "$TOML" ]]; then
  echo "Missing $TOML — start Pi-hole once: npm run nas:pihole:up" >&2
  exit 1
fi

export IP DOMAIN TOML
python3 <<'PY'
import os, re

ip = os.environ["IP"]
domain = os.environ["DOMAIN"]
toml = os.environ["TOML"]

hosts = [
    "cortex", "app", "api", "jellyfin", "radarr", "sonarr", "prowlarr",
    "qbittorrent", "qbit", "sabnzbd", "pihole", "nextcloud", "cloud",
    "immich", "photos", "grafana", "prometheus",
]
entries = [f'  "{ip} {h}.{domain}"' for h in hosts]
block = "hosts = [\n" + ",\n".join(entries) + "\n]"

with open(toml, encoding="utf-8") as f:
    text = f.read()

# Pi-hole v6: only replace [dns] custom records, not dhcp/ntp hosts = [] blocks.
marker = "Array of custom DNS records each one in HOSTS form"
idx = text.find(marker)
if idx < 0:
    raise SystemExit("Could not find dns custom hosts section in pihole.toml")
chunk = text[idx:]
m = re.search(r"hosts = \[[^\]]*\]", chunk)
if not m:
    raise SystemExit("Could not find dns.hosts in pihole.toml")
text = text[: idx + m.start()] + block + text[idx + m.end() :]
text = text.replace("etc_dnsmasq_d = false", "etc_dnsmasq_d = true")

with open(toml, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Updated {len(hosts)} records in pihole.toml ({domain} → {ip})")
PY

# Optional dnsmasq.d copy for reference
DNSMASQ_DIR="${NAS_ROOT}/appdata/pihole/etc-dnsmasq.d"
mkdir -p "$DNSMASQ_DIR"
{
  echo "# Mirror of pihole.toml [dns] hosts — Pi-hole v6 reads pihole.toml first"
  echo "address=/.${DOMAIN}/${IP}"
} >"${DNSMASQ_DIR}/99-cortex-services.conf"

log "Wrote DNS records to $TOML"

PIHOLE_CTR="$(docker ps --format '{{.Names}}' | grep -E 'cortex-pihole$|_cortex-pihole$' | head -1 || true)"
if [[ -n "${PIHOLE_CTR:-}" ]]; then
  docker exec "$PIHOLE_CTR" pihole restartdns >/dev/null 2>&1 || \
    docker exec "$PIHOLE_CTR" killall -HUP pihole-FTL >/dev/null 2>&1 || true
  log "Restarted Pi-hole DNS ($PIHOLE_CTR)"
else
  log "Pi-hole not running — start: npm run nas:pihole:up"
fi

echo ""
echo "Use these URLs (DNS name + port):"
printf "  %-14s http://%-22s\n" "Jellyfin" "jellyfin.${DOMAIN}:8096"
printf "  %-14s http://%-22s\n" "Radarr" "radarr.${DOMAIN}:7878"
printf "  %-14s http://%-22s\n" "Sonarr" "sonarr.${DOMAIN}:8989"
printf "  %-14s http://%-22s\n" "Prowlarr" "prowlarr.${DOMAIN}:9696"
printf "  %-14s http://%-22s\n" "qBittorrent" "qbittorrent.${DOMAIN}:8089"
printf "  %-14s http://%-22s\n" "Pi-hole" "pihole.${DOMAIN}:8090/admin/"
printf "  %-14s http://%-22s\n" "Cortex web" "cortex.${DOMAIN}:8080"
printf "  %-14s http://%-22s\n" "Cortex API" "api.${DOMAIN}:4000"
printf "  %-14s http://%-22s\n" "Nextcloud" "cloud.${DOMAIN}:8081"
printf "  %-14s http://%-22s\n" "Immich" "photos.${DOMAIN}:2283"
printf "  %-14s http://%-22s\n" "SABnzbd" "sabnzbd.${DOMAIN}:8082"
echo ""
echo "Wildcard: any name.${DOMAIN} → ${IP} (dnsmasq address=/.${DOMAIN}/)"
echo ""
echo "Clients must use Pi-hole DNS (Tailscale: https://login.tailscale.com/admin/dns → ${IP})."
echo "Test: dig +short jellyfin.${DOMAIN} @${IP}"
