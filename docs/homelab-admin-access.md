# Homelab admin access (logins & URLs)

## Jellyfin shows random numbers at the top?

That string is the **server name** Jellyfin picked from the Docker container hostname (e.g. `99e27d2162ce`).

**Fix:**

1. **Dashboard → General → Server name** → e.g. `Cortex Media`, save, or  
2. Host script: set `JELLYFIN_SERVER_NAME` in `deploy/nas/.env`, then:

```bash
npm run nas:jellyfin:server-name
npm run nas:jellyfin:recreate
```

Set `JELLYFIN_PUBLISHED_URL` in `deploy/nas/.env` so TVs/apps get playable links (`http://jellyfin.cortex:8096` with Pi-hole DNS, or `http://10.0.0.49:8096` on LAN).

---

## Is there one universal admin password?

**Not natively.** Jellyfin, Nextcloud, Cortex, Pi-hole, and qBittorrent each have their own user stores. Radarr/Sonarr/Prowlarr can run with **no web login** on the tailnet (`npm run media:fix-auth`).

### Practical options (best → heavier)

| Approach | What you get | Effort |
|----------|----------------|--------|
| **Password manager** | One vault; entries for each URL + login | Low — recommended |
| **Shared admin note** | One doc listing URLs + which `.env` file holds each password | Low |
| **Same password everywhere** | Manually set the same strong password in Jellyfin admin, Nextcloud admin, qBit, Pi-hole, Cortex | Medium — weak if one app leaks |
| **Tailscale + no *arr login** | Network trust; only apps that need passwords (Jellyfin, cloud, qBit) | Done for *arr |
| **Authelia / Authentik + reverse proxy** | One login page in front of many UIs | High — best real SSO for homelab |

Cortex does **not** replace SSO for Jellyfin/Nextcloud today; the Homelab page is a **launcher** (open links), not a single sign-on gate.

### Where each admin password lives

| Service | Login | Stored in |
|---------|--------|-----------|
| **Cortex** | Your email + OTP/PIN | Postgres; demo vars in `deploy/homelab/env/api.env` |
| **Jellyfin** | Per-user accounts | `appdata/jellyfin/config/` (UI: Dashboard → Users) |
| **Nextcloud** | `admin` + password | `deploy/nas/.env` (`NEXTCLOUD_ADMIN_*`) |
| **qBittorrent** | `admin` | `deploy/nas/media-stack/.env` (`QBITTORRENT_PASSWORD`) |
| **Pi-hole** | Web admin | `deploy/nas/pihole/.env` (`PIHOLE_WEBPASSWORD`) |
| **Radarr / Sonarr / Prowlarr** | Usually none on tailnet | API keys in `appdata/*/config.xml` |

### Admin URL cheat sheet (Pi-hole DNS)

See [pihole-local-dns.md](./pihole-local-dns.md). Household users only need Jellyfin + Nextcloud (+ optional Immich).

---

## If you want real single sign-on later

Typical homelab pattern:

1. **Caddy** or **Traefik** on `*.cortex` with HTTPS  
2. **Authelia** in front → one username/password (or passkeys)  
3. Put admin UIs behind the proxy; keep Jellyfin/Nextcloud user accounts for app features, or add LDAP

That is a separate project; Pi-hole friendly names are only DNS, not authentication.
