# Media stack (NordVPN + Gluetun)

Download automation for Jellyfin. **qBittorrent** and the *arr apps use NordVPN (Gluetun). **SABnzbd (Usenet)** runs **without** VPN for full speed (SSL to your provider). Jellyfin in `../docker-compose.yml` stays on Tailscale/LAN.

## What runs

| Service | Port | VPN? | Purpose |
|---------|------|------|---------|
| Gluetun | — | exit node | NordVPN tunnel |
| **SABnzbd** | **8082** | **no** | **Usenet (fast) → `downloads/complete`** |
| qBittorrent | 8089 | yes | Torrent fallback → `downloads` |
| Prowlarr | 9696 | yes | Indexers (torrent + Usenet) |
| Radarr | 7878 | yes | Movies → `/media/movies` |
| Sonarr | 8989 | yes | TV → `/media/tv` |
| Jellyfin | 8096 | **no** | Plays from `/media` (parent compose) |

## 1. NordVPN credentials

Nord **does not** use your email/password for Gluetun. Use one of:

### Option A — OpenVPN (recommended to start)

1. Log in at [Nord Account → Manual configuration → Service credentials](https://my.nordaccount.com/dashboard/nordvpn/manual-configuration/service-credentials/)
2. Copy **Username** and **Password** (service credentials)
3. In `.env`:

```env
VPN_TYPE=openvpn
OPENVPN_USER=your_service_username
OPENVPN_PASSWORD=your_service_password
SERVER_COUNTRIES=United States
```

### Option B — WireGuard (NordLynx, often faster)

1. Same Nord Account → **Manual setup** → generate a WireGuard / NordLynx key, or use their token flow documented in [Gluetun NordVPN wiki](https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/nordvpn.md#obtain-your-wireguard-private-key)
2. In `.env`:

```env
VPN_TYPE=wireguard
WIREGUARD_PRIVATE_KEY=your_base64_private_key
SERVER_COUNTRIES=United States
```

Leave `OPENVPN_*` empty when using WireGuard.

## 2. Host directories

From repo root:

```bash
NAS_DATA_ROOT=/data ./scripts/nas-init-dirs.sh
```

## 3. Start

```bash
cd deploy/nas/media-stack
cp .env.example .env
# edit .env — add Nord credentials

docker compose --env-file .env up -d
docker compose logs -f gluetun   # wait for "healthy" / "IP is"
```

## 4. Verify VPN

```bash
docker compose exec gluetun wget -qO- https://ipinfo.io/ip
```

Should show a Nord exit IP, not your home IP.

## 5. First-time app setup

Open on Tailscale/LAN (replace host with your machine):

| App | URL | Default login |
|-----|-----|----------------|
| **SABnzbd** | `http://100.x.x.x:8082` | wizard on first visit |
| qBittorrent | `http://100.x.x.x:8089` | `admin` / see container logs for temp password |
| Prowlarr | `http://100.x.x.x:9696` | create on first visit |
| Radarr | `http://100.x.x.x:7878` | create on first visit |
| Sonarr | `http://100.x.x.x:8989` | create on first visit |

On your **cortex** box today:

| App | Tailscale | LAN |
|-----|-----------|-----|
| SABnzbd | http://100.104.120.29:8082 | http://10.0.0.49:8082 |

**qBittorrent temp password:**

```bash
docker compose logs qbittorrent 2>&1 | grep -i password
```

### Link apps together

1. **Prowlarr** → Settings → Apps → add Radarr + Sonarr (use `http://localhost:7878` and `http://localhost:8989` — same Gluetun network namespace)
2. **Prowlarr** → Indexers → add Usenet indexers (e.g. [NZBGeek](https://nzbgeek.info), DrunkenSlug) — needs a paid indexer account
3. **SABnzbd** (first-run wizard or Settings → Servers) → add your **Usenet provider** (Newshosting, Eweka, UsenetExpress, etc.):
   - Host/port/SSL from provider docs (usually port **563** SSL)
   - Username + password from provider
   - Set **connections** to ~50–80% of what your plan allows (faster without hammering)
   - Folders (already mapped in Docker):
     - Temporary: `/incomplete-downloads`
     - Completed: `/downloads`
4. **SABnzbd** → Settings → General → copy **API key** (needed for *arr)
5. **Radarr / Sonarr** → Settings → Download clients → **+** → **SABnzbd**
   - Host: `172.17.0.1` (Docker bridge — Sonarr/Radarr are inside Gluetun, SAB is on the host)
   - Port: `8082`
   - API key: from SABnzbd
   - Category: `movies` (Radarr) / `tv` (Sonarr) — SAB creates these automatically
   - **Priority:** set SABnzbd **higher** than qBittorrent (Usenet first, torrent fallback)
6. **Radarr / Sonarr** → Settings → Download clients → qBittorrent (optional fallback)
   - Host: `localhost`
   - Port: `8089`
7. **Radarr** → root folder `/media/movies`
8. **Sonarr** → root folder `/media/tv`
9. **Jellyfin** → Libraries → add `/media/movies`, `/media/tv`, `/media/music`

## Usenet provider (required)

SABnzbd is the client; you still need:

| Piece | What to get |
|-------|-------------|
| **Provider** | Monthly Usenet subscription (e.g. Newshosting, Eweka, Frugal) — unlimited plan + SSL |
| **Indexer** | NZB search site (e.g. NZBGeek ~$12/yr) — add in **Prowlarr**, sync to Sonarr/Radarr |

Without both, SAB has nothing to download. Torrents via qBittorrent still work with Prowlarr alone.

## Usenet vs torrents in *arr

In Radarr/Sonarr → **Settings → Download clients**, drag **SABnzbd above qBittorrent**. New grabs try Usenet first (usually much faster); torrents remain as backup when no NZB exists.

## 6. Jellyfin libraries

Jellyfin reads the same tree under `NAS_DATA_ROOT/media`. After Radarr/Sonarr import, scan libraries in Jellyfin (Dashboard → Libraries → Scan).

## Organize finished downloads for Jellyfin

From repo root (moves movies from `downloads/` → `movies/`, TV episodes → `tv/Show/Season 01/`, deletes fake `.scr` executables):

```bash
NAS_DATA_ROOT=/home/greyhill/nas-data ./scripts/organize-jellyfin-downloads.sh
```

Then in Jellyfin: **Dashboard → Libraries → Scan all libraries**.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Gluetun unhealthy | Check `OPENVPN_USER`/`PASSWORD` are **service** credentials, not login |
| Can't open UI on Tailscale | Confirm `FIREWALL_OUTBOUND_SUBNETS` includes `100.64.0.0/10` |
| *arr can't reach qBittorrent | Use `localhost:8089`, not the host IP |
| *arr can't reach SABnzbd | Use `172.17.0.1:8082` (not `localhost`) from Radarr/Sonarr |
| SAB slow / 0 connections | Check provider SSL port (563), raise connection count in SAB |
| Port 8082 in use | Change `SABNZBD_PORT` in `.env` and `WEBUI_PORT` in compose |

## Related

- [docs/nas-homelab-layout.md](../../../docs/nas-homelab-layout.md)
- [deploy/nas/README.md](../README.md)
