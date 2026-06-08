# 10TB storage bay (5×2TB Hitachi)

One **512GB SSD** holds appdata (`/mnt/cortex/nas-data`). Five **2TB** disks in the bay are for media and growth.

## Current layout (cortex host)

| Disk | Serial (last 6) | Mount | Role |
|------|-----------------|-------|------|
| **sdc** | …6D8XT | `/mnt/cortex/hdd2tb` | **Primary media** — movies, TV, downloads (~1TB, NTFS) |
| **sdf** | …6W0RT | (auto `/run/media/.../New Volume`) | Empty NTFS — will become **hdd-2** (downloads, ext4) |
| **sdd** | …2M0RT | — | Raw — **hdd-3** (movies overflow, ext4) |
| **sde** | …2LPBT | — | Raw — **hdd-4** (TV overflow, ext4) |
| **sdg** | …6VXAT | — | Raw — **hdd-5** (photos / cloud / archive, ext4) |

Docker uses `NAS_DATA_ROOT=/mnt/cortex/nas-data` with `nas-data/media` → merged media pool.

## One-time setup

Run in a **system terminal** (needs sudo for format/mount):

```bash
cd ~/Documents/Cortex

# 1) Preview — no changes
npm run storage:10tb:setup -- --dry-run

# 2) Format + mount new disks + mergerfs pool (type YES when prompted)
npm run storage:10tb:setup

# 3) Optional: move downloads off NTFS onto ext4 hdd-2 (faster torrent writes)
npm run storage:10tb:setup -- --migrate-downloads --yes
```

## After setup

```bash
df -h /mnt/cortex/hdd2tb /mnt/cortex/hdd-{2,3,4,5} /mnt/cortex/media-merged
readlink -f /mnt/cortex/nas-data/media   # → /mnt/cortex/media-merged
```

Radarr/Sonarr/Jellyfin paths stay **`/media/movies`**, **`/media/tv`**, **`/media/downloads`** inside containers — no *arr reconfig needed.

## Why this layout

| Choice | Reason |
|--------|--------|
| Keep **sdc NTFS** as-is | ~1TB already on disk; no risky full migration |
| **ext4** on new drives | Native Linux performance; better for Docker + torrents |
| **mergerfs** pool | Jellyfin/*arr see one `media/` tree; new files land on most-free disk |
| **hdd-2 = downloads** | Heavy write load off NTFS |
| **appdata on SSD** | Small fast disk for Postgres configs, not 4K movies |

## Boot persistence

The script adds `/etc/fstab` entries using `/dev/disk/by-id/` (stable across bay order).  
sdc already has fstab + `mnt-cortex-hdd2tb.mount` systemd unit.

If a drive fails to mount after reboot:

```bash
npm run storage:2tb:mount
npm run storage:10tb:setup -- --mount-only
```

## Space check

```bash
df -h /mnt/cortex/hdd2tb /mnt/cortex/hdd-{2,3,4,5}
du -sh /mnt/cortex/media-merged/*
```

## Related

- [storage-2tb-media.md](./storage-2tb-media.md) — original single 2TB wire-up
- [nas-homelab-layout.md](./nas-homelab-layout.md) — NAS directory tree
- [radarr-torrents-quickstart.md](./radarr-torrents-quickstart.md) — download stack
