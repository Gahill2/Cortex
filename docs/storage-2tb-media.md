# 2TB drive for Jellyfin / Radarr / Sonarr

The Hitachi **~2TB** disk is `/dev/sdc` (partition `/dev/sdc2`). Your main NAS data lives on **`/mnt/cortex/nas-data`** (~500GB, often full). Media libraries (~380GB) should live on the 2TB disk.

## One-time setup (run on the cortex PC)

```bash
# 1) Mount the 2TB disk (sudo in a terminal, or docker nsenter fallback)
npm run storage:2tb:mount

# 2) Move movies/tv/downloads to the big disk (keeps appdata on nas-data)
npm run storage:2tb:wire -- --yes

# 3) Optional: mount at boot before Docker (needs sudo once)
npm run storage:2tb:install-systemd
```

If a reboot leaves `Transport endpoint is not connected` on `/mnt/cortex/hdd2tb`, run `npm run storage:2tb:mount` again, then recreate media containers (see `scripts/homelab-docker-stop-container.sh`).

After wiring, Docker still uses `NAS_DATA_ROOT=/mnt/cortex/nas-data`, but `nas-data/media` is a symlink to `/mnt/cortex/hdd2tb/media`. Radarr/Sonarr/Jellyfin paths stay the same.

## Check space

```bash
df -h /mnt/cortex/nas-data /mnt/cortex/hdd2tb
```

## Logins

```bash
npm run media:fix-auth
```

- **Radarr / Sonarr / Prowlarr:** no login over Tailscale
- **qBittorrent:** `admin` + `QBITTORRENT_PASSWORD` in `deploy/nas/media-stack/.env`
