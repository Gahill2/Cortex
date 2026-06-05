# Pi-hole local DNS names (Jellyfin, Radarr, …)

Pi-hole can answer custom hostnames so you do not memorize `100.104.120.29` for every service.

**DNS gives you a name → IP.** Ports stay the same (`:8096`, `:7878`, …) unless you add a reverse proxy later.

## One-time setup

```bash
npm run nas:pihole:local-dns
```

Default domain: **`cortex`** → `jellyfin.cortex`, `radarr.cortex`, etc.

Custom domain:

```bash
npm run nas:pihole:local-dns -- --domain homelab
```

LAN-only answers (router DNS → `10.0.0.49`):

```bash
PIHOLE_DNS_TARGET=lan npm run nas:pihole:local-dns
```

## URLs (after setup, Tailscale IP as target)

| Service | URL |
|---------|-----|
| Cortex (web) | http://cortex.cortex:8080 |
| Cortex API | http://api.cortex:4000 |
| Jellyfin | http://jellyfin.cortex:8096 |
| Radarr | http://radarr.cortex:7878 |
| Sonarr | http://sonarr.cortex:8989 |
| Prowlarr | http://prowlarr.cortex:9696 |
| qBittorrent | http://qbittorrent.cortex:8089 |
| SABnzbd | http://sabnzbd.cortex:8082 |
| Nextcloud | http://cloud.cortex:8081 |
| Immich | http://photos.cortex:2283 |
| Pi-hole | http://pihole.cortex:8090/admin/ |
| Grafana | http://grafana.cortex:3000 |
| Prometheus | http://prometheus.cortex:9090 |

Any `*.cortex` name resolves to the cortex host IP (wildcard in dnsmasq).

**Homelab UI:** set `HOMELAB_DNS_DOMAIN=cortex` in `deploy/homelab/env/api.env` so Open links use these names (health checks still use the Tailscale IP).

## Make devices use Pi-hole

**Tailscale (phones/laptops away from home):**

1. [Tailscale admin → DNS](https://login.tailscale.com/admin/dns)
2. Nameserver → your cortex Tailscale IP (`100.104.120.29`)
3. Fallback → `1.1.1.1`
4. **Override local DNS** on

Verify: `npm run nas:pihole:tailscale-dns`

**Home LAN:** router DHCP DNS → `10.0.0.49`, then re-run with `PIHOLE_DNS_TARGET=lan`.

## Test

```bash
dig +short jellyfin.cortex @100.104.120.29
# → 100.104.120.29
```

## Config file

Generated at:

`$NAS_DATA_ROOT/appdata/pihole/etc-dnsmasq.d/99-cortex-services.conf`

Re-run `nas:pihole:local-dns` after Tailscale IP changes (`npm run nas:pihole:tailscale-dns:sync`).

See also: [deploy/nas/pihole/README.md](../deploy/nas/pihole/README.md)
