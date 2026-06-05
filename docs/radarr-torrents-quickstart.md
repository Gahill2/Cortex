# Movies & TV via torrents (Radarr / Sonarr + Prowlarr + qBittorrent)

Yes — **this is torrents**, same idea as manually adding a magnet in qBittorrent. Radarr just automates search → pick release → send to qBittorrent → move file into Jellyfin’s movie folder.

## How it works (simple)

```
You add a movie in Radarr
    → Radarr asks Prowlarr to search torrent sites (indexers)
    → You pick a release (or Radarr auto-picks)
    → Radarr sends the torrent to qBittorrent
    → qBittorrent downloads over NordVPN (Gluetun)
    → Radarr imports the file to /media/movies
    → Jellyfin library scan → watch
```

| App | Role | URL (Tailscale) |
|-----|------|-----------------|
| **Radarr** | Movie list + “install this movie” | http://100.104.120.29:7878 |
| **Prowlarr** | Search torrent sites | http://100.104.120.29:9696 |
| **qBittorrent** | Actual download (torrent client) | http://100.104.120.29:8089 |
| **Sonarr** | TV shows + seasons/episodes | http://100.104.120.29:8989 |
| **Jellyfin** | Play | http://100.104.120.29:8096 |

## One-time setup (cortex)

Run after the media stack is up:

```bash
npm run media:up          # Gluetun + qBittorrent + *arr
npm run media:setup-arr   # root folders, download client, Prowlarr links
npm run media:organize    # move finished files from downloads/ → movies|tv
```

- qBittorrent linked in Radarr/Sonarr (`localhost:8089`, VPN via Gluetun)
- Prowlarr linked to Radarr + Sonarr
- **Indexers:** run `npm run media:setup-indexers` (adds YTS, LimeTorrents, TorrentsCSV, TorrentDownload, The Pirate Bay, EZTV). Manage at **Prowlarr → Settings → Indexers**: http://100.104.120.29:9696/settings/indexers

**Logins:** Radarr, Sonarr, and Prowlarr have **no login** over Tailscale (CGNAT trusted). If a browser still asks for credentials, run `npm run media:fix-auth`.

**qBittorrent only:** **admin** + password from `deploy/nas/media-stack/.env` (`QBITTORRENT_PASSWORD`). After changes run `npm run media:fix-auth`.

**2TB disk:** mount with `npm run storage:2tb:mount`, then move libraries with `npm run storage:2tb:wire -- --yes` (frees space on the ~500GB nas-data disk).

## Add a TV show (Sonarr)

1. Open **Sonarr** → http://100.104.120.29:8989  
2. **Series** → **Add new** → search show → pick quality profile → **Add series**.  
3. Open the series → **Search** (manual or per-season) → pick release → **Download**.  
4. qBittorrent downloads; Sonarr imports to `/media/tv/Show Name/Season 01/`.  
5. Jellyfin **TV** library scan.

Same torrent flow as movies; **Sonarr** tracks seasons/episodes instead of one file per title.

## Add a movie (every time)

1. Open **Radarr** → **Movies** → **Add new** (or search box).
2. Pick the film → choose **quality profile** (e.g. HD-1080p) → **Add movie**.
3. Click the movie → **Search** (manual search icon) — wait for results from Prowlarr.
4. Click a release → **download** (or enable **Automatic Search** on add).
5. Open **qBittorrent** — torrent should appear and download over VPN.
6. When finished, Radarr **imports** to `movies/`; **Jellyfin** → Libraries → **Scan** if it doesn’t show up.

## Torrent vs Usenet (what you skipped)

| | Torrents (your setup) | Usenet (option 1) |
|--|----------------------|-------------------|
| **Like** | qBittorrent magnets | Different protocol; SABnzbd client |
| **Speed** | Depends on seeders | Often faster |
| **VPN** | Yes (Gluetun) | Not required for downloads |
| **Cost** | Free indexers; VPN you have | Provider + indexer fees |

## If search finds nothing

- Try another movie; **YTS** only has certain releases.
- In **Prowlarr** → Indexers → add more (e.g. **EZTV** for TV in Sonarr).
- Some sites block VPN/datacenter IPs — try another indexer.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Radarr “no download client” | Settings → Download clients → Test qBittorrent |
| qBittorrent login fails | Reset password in qBittorrent; update Radarr client |
| Download stuck | Check Gluetun healthy: `docker logs cortex-gluetun` |
| Movie not in Jellyfin | Radarr Activity → check import; run `organize-jellyfin-downloads.sh` |

See also: [deploy/nas/media-stack/README.md](../deploy/nas/media-stack/README.md)
