#!/usr/bin/env bash
# Validate videos with ffprobe, import complete downloads with correct names, clean bad partials.
# Does NOT restart Jellyfin.
set -euo pipefail

ROOT="${NAS_DATA_ROOT:-/mnt/cortex/nas-data}"
MOVIES="$ROOT/media/movies"
TV="$ROOT/media/tv"
DL="$ROOT/media/downloads"
CORRUPT="$MOVIES/.corrupt-backup"
mkdir -p "$CORRUPT" "$MOVIES" "$TV" "$DL"

log() { echo "[media] $*"; }

is_valid_video() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  [[ "$(stat -c%s "$f" 2>/dev/null || echo 0)" -gt 50000000 ]] || return 1
  local dur
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || true)"
  [[ -n "$dur" ]] && awk -v d="$dur" 'BEGIN { exit (d >= 60 ? 0 : 1) }'
}

import_movie() {
  local src="$1" dest_dir="$2" dest_file="$3"
  is_valid_video "$src" || { log "skip invalid: $src"; return 1; }
  mkdir -p "$MOVIES/$dest_dir"
  if [[ -f "$MOVIES/$dest_dir/$dest_file" ]]; then
    log "exists: $dest_dir/$dest_file"
    return 0
  fi
  mv -n "$src" "$MOVIES/$dest_dir/$dest_file"
  log "movie → $dest_dir/$dest_file"
}

import_tv_file() {
  local src="$1" show="$2" season="$3"
  is_valid_video "$src" || return 1
  local dest="$TV/$show/Season $season"
  mkdir -p "$dest"
  local base
  base="$(basename "$src")"
  [[ -f "$dest/$base" ]] && return 0
  mv -n "$src" "$dest/$base"
  log "tv → $dest/$base"
}

# --- Remove known-bad partials in downloads ---
for bad in \
  "$DL/Home.2015.1080p.BluRay.DDP.7.1.x265-EDGE2020.mkv" \
  "$DL/Red (2010) [1080p] {5.1}/Red.BluRay.1080p.x264.5.1.Judas.mp4" \
  "$DL/www.UIndex.org    -    Five Nights at Freddys 2023 UHD BluRay 1080p DD Atmos 5 1 DoVi HDR10 x265-SM737/"*.mkv; do
  if [[ -f "$bad" ]] && ! is_valid_video "$bad"; then
    mv -n "$bad" "$CORRUPT/$(basename "$bad").partial-$(date +%Y%m%d)" 2>/dev/null || rm -f "$bad"
    log "quarantined bad: $bad"
  fi
done

# --- Import complete movies (explicit names; avoid organize script bracket bugs) ---
shopt -s nullglob
for src in "$DL/A Minecraft Movie (2025) [1080p] [BluRay] [5.1] [YTS.MX]"/*.mp4; do
  import_movie "$src" "A Minecraft Movie (2025)" "A Minecraft Movie (2025).mp4"
done
for src in "$DL/Avatar Fire And Ash (2025) [1080p] [WEBRip] [x265] [10bit] [5.1] [YTS.BZ]"/*.mp4; do
  import_movie "$src" "Avatar Fire and Ash (2025)" "Avatar Fire and Ash (2025).mp4"
done
for src in "$DL/Project Hail Mary (2026) [IMAX] [1080p] [WEBRip] [5.1] [YTS.BZ]"/*.mp4; do
  import_movie "$src" "Project Hail Mary (2026)" "Project Hail Mary (2026).mp4"
done
if [[ -f "$DL/Cinderella.1950.1080p.BluRay.DDP.7.1.H.265-EDGE2020.mkv" ]] && is_valid_video "$DL/Cinderella.1950.1080p.BluRay.DDP.7.1.H.265-EDGE2020.mkv"; then
  import_movie "$DL/Cinderella.1950.1080p.BluRay.DDP.7.1.H.265-EDGE2020.mkv" "Cinderella (1950)" "Cinderella (1950).mkv"
fi

# --- TV: Severance + Spider-Noir from downloads if present ---
for f in "$DL/Severance.S01.1080p.WEBRip.x265[eztv.re]"/*.{mp4,mkv}; do
  [[ -f "$f" ]] && import_tv_file "$f" "Severance" "01"
done
for f in "$DL/Severance.S02.1080p.WEBRip.10bit.DDP5.1.x265-HODL"/*.{mp4,mkv}; do
  [[ -f "$f" ]] && import_tv_file "$f" "Severance" "02"
done
for f in "$DL/Spider-Noir.S01.1080p.WEBRip.10Bit.DDP5.1.x265-NeoNoir"/*.{mp4,mkv}; do
  [[ -f "$f" ]] && import_tv_file "$f" "Spider-Noir" "01"
done

find "$DL" -mindepth 1 -type d -empty -delete 2>/dev/null || true
log "done validate/import"
