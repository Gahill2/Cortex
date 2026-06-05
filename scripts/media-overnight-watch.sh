#!/usr/bin/env bash
# Overnight monitor: storage, qBittorrent, Radarr/Sonarr imports, Jellyfin library scan.
# Does NOT restart or stop Jellyfin (safe while watching).
#
#   npm run media:overnight-watch              # one check now
#   npm run media:overnight-watch -- --loop    # every hour until morning
#   npm run media:overnight-watch -- --loop --interval 3600 --until 08:00
#
# Background:
#   nohup npm run media:overnight-watch -- --loop >> ~/media-overnight.log 2>&1 &
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAS_ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
[[ -f "$ROOT/deploy/nas/media-stack/.env" ]] && NAS_ROOT="$(grep -E '^NAS_DATA_ROOT=' "$ROOT/deploy/nas/media-stack/.env" | cut -d= -f2- | tr -d '"' || echo "$NAS_ROOT")"
NAS_ROOT="${NAS_DATA_ROOT:-$NAS_ROOT}"
LOG_DIR="${MEDIA_WATCH_LOG_DIR:-$NAS_ROOT/logs}"
LOG_FILE="$LOG_DIR/media-overnight.log"
LOOP=0
INTERVAL="${MEDIA_WATCH_INTERVAL_SEC:-3600}"
UNTIL=""
MAX_HOURS=""
START_EPOCH="$(date +%s)"
JELLYFIN_CTR="${JELLYFIN_CONTAINER:-cortex-nas-jellyfin-1}"
docker ps --format '{{.Names}}' 2>/dev/null | grep -qE 'cortex-nas-jellyfin-1|_jellyfin' && \
  JELLYFIN_CTR="$(docker ps --format '{{.Names}}' | grep -E 'jellyfin' | head -1)" || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop) LOOP=1; shift ;;
    --interval) INTERVAL="${2:?}"; shift 2 ;;
    --interval=*) INTERVAL="${1#*=}"; shift ;;
    --until) UNTIL="${2:?}"; shift 2 ;;
    --until=*) UNTIL="${1#*=}"; shift ;;
    --hours) MAX_HOURS="${2:?}"; shift 2 ;;
    --hours=*) MAX_HOURS="${1#*=}"; shift ;;
    -h|--help)
      echo "Usage: $0 [--loop] [--interval 3600] [--hours 12] [--until 08:00]"
      exit 0
      ;;
    *) shift ;;
  esac
done

mkdir -p "$LOG_DIR"

log() {
  local line="[$(date -Iseconds)] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE"
}

read_key() {
  grep -oP '(?<=<ApiKey>)[^<]+' "$NAS_ROOT/appdata/$1/config.xml" 2>/dev/null | head -1
}

jellyfin_scan_libraries() {
  # API scan only — never docker restart/stop Jellyfin
  local ip api_key port
  ip="$(tailscale ip -4 2>/dev/null | head -1 || echo 127.0.0.1)"
  port=8096
  api_key="${JELLYFIN_API_KEY:-}"
  if [[ -z "$api_key" && -f "$NAS_ROOT/appdata/jellyfin/config/data/jellyfin.db" ]]; then
    api_key="$(DB="$NAS_ROOT/appdata/jellyfin/config/data/jellyfin.db" python3 <<'PY'
import sqlite3, os
try:
    row = sqlite3.connect(os.environ["DB"]).execute(
        "SELECT AccessToken FROM ApiKeys ORDER BY DateLastActivity DESC LIMIT 1"
    ).fetchone()
    print(row[0] if row else "")
except Exception:
    print("")
PY
)"
  fi
  if [[ -z "${api_key:-}" ]]; then
    log "Jellyfin: skip API scan (no API key — Dashboard → API Keys → +, paste into JELLYFIN_API_KEY in media-stack/.env)"
    return 0
  fi
  if curl -sf -X POST -H "X-Emby-Token: $api_key" \
    "http://${ip}:${port}/Library/Refresh" >/dev/null 2>&1; then
    log "Jellyfin: Library/Refresh triggered (API only, no restart)"
    return 0
  fi
  log "Jellyfin: scan request failed (server up? API key valid?)"
}

run_check() {
  log "========== media overnight check =========="

  # Storage
  df -h "$NAS_ROOT" /mnt/cortex/hdd2tb 2>/dev/null | while read -r line; do
    log "disk: $line"
  done
  use_pct="$(df "$NAS_ROOT" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%' || echo 0)"
  if [[ "${use_pct:-0}" -ge 95 ]]; then
    log "WARN: nas-data ${use_pct}% full — pause new downloads or finish 2TB wire"
  elif [[ "${use_pct:-0}" -ge 85 ]]; then
    log "WARN: nas-data ${use_pct}% full"
  fi

  if pgrep -af 'rsync.*hdd2tb' >/dev/null 2>&1; then
    du -sh /mnt/cortex/hdd2tb/media 2>/dev/null | while read -r line; do
      log "2TB copy in progress: $line"
    done
    log "NOTE: 2TB rsync running — skipping organize/import nudge this hour"
    jellyfin_scan_libraries
    return 0
  fi

  # VPN
  if docker ps --format '{{.Names}}' | grep -qx cortex-gluetun; then
    if docker exec cortex-gluetun wget -qO- --timeout=6 https://am.i.mullvad.net/json 2>/dev/null | grep -q '"ip"'; then
      vpn_ip="$(docker exec cortex-gluetun wget -qO- --timeout=6 https://am.i.mullvad.net/json 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip','?'))" 2>/dev/null || echo ok)"
      log "VPN OK (exit $vpn_ip)"
    else
      log "WARN: Gluetun up but VPN check failed"
    fi
  fi

  # qBittorrent
  if docker ps --format '{{.Names}}' | grep -qE 'cortex-qbittorrent|_qbittorrent'; then
    QPASS="$(grep -E '^QBITTORRENT_PASSWORD=' "$ROOT/deploy/nas/media-stack/.env" 2>/dev/null | cut -d= -f2- || echo GMmr44TI8)"
    docker exec cortex-radarr curl -sf -u "admin:${QPASS}" http://127.0.0.1:8089/api/v2/torrents/info 2>/dev/null | python3 -c "
import sys,json
t=json.load(sys.stdin)
dl=[x for x in t if x.get('state') in ('downloading','stalledDL','metaDL','forcedDL','queuedDL')]
done=[x for x in t if x.get('progress',0)>=0.99]
miss=[x for x in t if x.get('state')=='missingFiles']
print(f'qbit: {len(dl)} downloading, {len(done)} complete, {len(miss)} missingFiles')
for x in dl[:5]:
    print(f\"  DL {x.get('progress',0)*100:.0f}% {x.get('name','')[:60]}\")
" 2>/dev/null | while read -r line; do log "$line"; done || log "WARN: qBittorrent API unreachable"
  fi

  # Organize finished files from downloads/
  if [[ -d "$NAS_ROOT/media/downloads" ]]; then
    n_vid="$(find "$NAS_ROOT/media/downloads" -type f \( -iname '*.mkv' -o -iname '*.mp4' \) -size +50M 2>/dev/null | wc -l)"
    if [[ "$n_vid" -gt 0 ]]; then
      log "Organizing $n_vid video(s) from downloads/"
      NAS_DATA_ROOT="$NAS_ROOT" bash "$ROOT/scripts/organize-jellyfin-downloads.sh" 2>&1 | while read -r line; do log "  $line"; done
    fi
  fi

  # Radarr / Sonarr
  RKEY="$(read_key radarr)"
  SKEY="$(read_key sonarr)"
  if [[ -n "${RKEY:-}" ]]; then
    curl -sf -H "X-Api-Key: $RKEY" -H "Content-Type: application/json" \
      -X POST http://127.0.0.1:7878/api/v3/command \
      -d '{"name":"DownloadedMoviesScan"}' >/dev/null 2>&1 || true
    curl -sf -H "X-Api-Key: $RKEY" http://127.0.0.1:7878/api/v3/queue 2>/dev/null | python3 -c "
import sys,json
q=json.load(sys.stdin).get('records',[])
print(f'Radarr queue: {len(q)}')
for r in q[:3]:
    print(f\"  {r.get('status')} {r.get('title','')[:50]}\")
" 2>/dev/null | while read -r line; do log "$line"; done
    curl -sf -H "X-Api-Key: $RKEY" http://127.0.0.1:7878/api/v3/history?pageSize=5 2>/dev/null | python3 -c "
import sys,json
for r in json.load(sys.stdin).get('records',[])[:3]:
    if r.get('eventType')=='downloadFolderImported':
        print(f\"  imported: {r.get('sourceTitle','')[:50]}\")
" 2>/dev/null | while read -r line; do log "$line"; done
  fi

  if [[ -n "${SKEY:-}" ]]; then
    curl -sf -H "X-Api-Key: $SKEY" -H "Content-Type: application/json" \
      -X POST http://127.0.0.1:8989/api/v3/command \
      -d '{"name":"DownloadedEpisodesScan"}' >/dev/null 2>&1 || true
  fi

  jellyfin_scan_libraries
  log "Check done. Log: $LOG_FILE"
}

should_stop() {
  if [[ -n "${MAX_HOURS:-}" ]]; then
    local elapsed=$(( $(date +%s) - START_EPOCH ))
    [[ "$elapsed" -ge $((MAX_HOURS * 3600)) ]]
    return
  fi
  [[ -n "${UNTIL:-}" ]] || return 1
  local h m now_sec until_sec
  h=$(date +%H)
  m=$(date +%M)
  now_sec=$((10#$h * 3600 + 10#$m * 60))
  h=$(echo "$UNTIL" | cut -d: -f1)
  m=$(echo "$UNTIL" | cut -d: -f2)
  until_sec=$((10#$h * 3600 + 10#$m * 60))
  # Morning stop window: e.g. --until 08:00 stops between 08:00–11:00
  [[ "$now_sec" -ge "$until_sec" && "$now_sec" -lt $((until_sec + 3 * 3600)) ]]
}

log "media-overnight-watch started (loop=$LOOP interval=${INTERVAL}s hours=${MAX_HOURS:-none} until=${UNTIL:-none})"
log "Jellyfin: scan-only via API — will NOT restart container ($JELLYFIN_CTR)"

if [[ "$LOOP" -eq 0 ]]; then
  run_check
  exit 0
fi

while true; do
  run_check
  if should_stop; then
    log "Reached --until $UNTIL, exiting"
    break
  fi
  log "Sleeping ${INTERVAL}s until next check..."
  sleep "$INTERVAL"
done
