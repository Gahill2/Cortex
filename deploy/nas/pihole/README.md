# Pi-hole (DNS ad blocking)

Blocks ads/trackers for any device that uses this host as its DNS server.

## Start

```bash
cd deploy/nas/pihole
cp .env.example .env
# Edit PIHOLE_WEBPASSWORD and PIHOLE_LOCAL_IP

docker compose --env-file .env up -d
```

## URLs (cortex homelab)

| Where | Admin UI |
|-------|----------|
| Tailscale | http://100.104.120.29:8090/admin/ |
| LAN | http://10.0.0.49:8090/admin/ |

## Use Pi-hole as DNS

Pick **one**:

### Whole home network (recommended)

Router / DHCP → set **DNS server** to `10.0.0.49` (this PC’s LAN IP).

### Tailscale — Split DNS (recommended: `.cortex` names work, internet never breaks)

Only `*.cortex` lookups go to Pi-hole; every other domain uses the device's normal DNS. If cortex is off, the rest of the internet keeps working on all tailnet devices.

**One-time (tailnet admin):**

1. [Tailscale admin → DNS](https://login.tailscale.com/admin/dns)
2. Keep **MagicDNS** on
3. **Nameservers** → **Add custom** → this host’s Tailscale IP (`tailscale ip -4`, e.g. `100.104.120.29`) → toggle **Restrict to domain** → enter `cortex`
4. **Remove** any global custom nameserver pointing at this host and turn **Override local DNS** **off**

**On each device:** leave Tailscale’s default **Use Tailscale DNS** enabled (`tailscale set --accept-dns=true`).

### Tailscale — global override (optional: tailnet-wide ad blocking, less resilient)

All DNS from every tailnet device flows through Pi-hole. **Tradeoff:** if Pi-hole or this host goes down (or its Tailscale IP changes), devices with Tailscale connected lose **all** DNS — the classic symptom is “only Jellyfin works, nothing else loads.”

1. [Tailscale admin → DNS](https://login.tailscale.com/admin/dns)
2. **Nameservers** → **Add custom** → this host’s Tailscale IP (no domain restriction)
3. **Add nameserver** again for **fallback** when cortex is off: `1.1.1.1` or `75.75.75.75`
4. Enable **Override local DNS**
5. Keep **MagicDNS** on

**Verify from cortex:**

```bash
npm run nas:pihole:tailscale-dns
# If Tailscale IP changed: npm run nas:pihole:tailscale-dns:sync
```

You should see `doubleclick.net` → `0.0.0.0` when querying `@<tailscale-ip>`.

**If ads still appear:** apps using DNS-over-HTTPS bypass Pi-hole. On Android turn off **Private DNS**; on iOS consider disabling **iCloud Private Relay** for testing. YouTube in-app ads are not fully blockable via DNS alone.

### Twitch ads (Tailscale + Pi-hole)

**Requires global override mode:** this section only applies if you chose the optional global override above. With the recommended **Split DNS**, only `*.cortex` lookups hit Pi-hole, so tailnet-wide ad/Twitch blocking is off (home Wi‑Fi devices still get it via router DNS → `10.0.0.49`). Verify:

```bash
npm run nas:pihole:tailscale-dns
dig +short doubleclick.net @100.104.120.29   # should be 0.0.0.0
```

**What DNS can do for Twitch:** Block separate ad/tracker hostnames (e.g. `edge.ads.twitch.tv`, `ads.twitch.tv`, Amazon ad endpoints). Your default list (Steven Black) does **not** include those — test today:

```bash
dig +short edge.ads.twitch.tv @100.104.120.29   # real IPs = not blocked yet
```

**Add Twitch-oriented blocking (optional):**

1. Pi-hole admin → **Group Management → Adlists** → add URL from `adlists.twitch-optional.txt` (recommended: HaGeZi Pro domains), or append that URL to `nas-data/.../etc-pihole/adlists.list`.
2. **Tools → Update Gravity** (or `docker exec <pihole-container> pihole -g`).
3. Re-test: `dig +short edge.ads.twitch.tv @100.104.120.29` → `0.0.0.0`.

If Twitch **won’t load** or chat breaks, whitelist the blocked domain in Pi-hole (Query Log → Allowlist).

**What DNS cannot do:** Pre-roll and mid-roll video ads are usually served from the **same** domains as the stream (`*.ttvnw.net`, etc.). Blocking those breaks playback. Even AdGuard’s docs list Twitch/YouTube as “not reliably blockable at DNS.”

**Best combo for Twitch in a browser (on any Tailscale device):**

1. Keep Tailscale DNS → Pi-hole (trackers + banner ad domains).
2. Install **uBlock Origin** on the browser you use for Twitch.
3. Under **My filters**, add: `twitch.tv##+js(twitch-videoad)`  
   Optional advanced setup: [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) `vaft-ublock-origin.js` in uBlock settings (see their README).

**Twitch mobile / TV apps:** Pi-hole may trim some telemetry; **in-app video ads** usually remain. No tailnet-wide fix without a client-side blocker (not available on all platforms).

**Per-device gotchas (same as general Pi-hole):**

| Device | Setting |
|--------|---------|
| Android | Settings → Network → **Private DNS** → Off |
| iOS | Disable **iCloud Private Relay** for testing; Wi‑Fi DNS → Automatic |
| All | Tailscale connected, **Use Tailscale DNS** enabled |

Recreate Pi-hole after changing `PIHOLE_TAILSCALE_IP`:

```bash
cd deploy/nas/pihole && docker compose --env-file .env up -d
```

### This PC only

Point `/etc/resolv.conf` or NetworkManager to `127.0.0.1` / `10.0.0.49` (may conflict with systemd-resolved — use router method if unsure).

## Port 53 conflicts

If `docker compose up` fails on port 53, another service (often `systemd-resolved`) is using it. Options:

1. Bind DNS to LAN IP only — change compose ports to `"10.0.0.49:53:53/tcp"` and `"10.0.0.49:53:53/udp"`.
2. Or disable stub resolver: set `DNSStubListener=no` in `/etc/systemd/resolved.conf`, then `sudo systemctl restart systemd-resolved`.

## Friendly names (Jellyfin, Radarr, …)

Pi-hole can map short hostnames to this server (no more typing the Tailscale IP for every app):

```bash
npm run nas:pihole:local-dns
```

Then use e.g. **http://jellyfin.cortex:8096** (ports unchanged). Full list: [docs/pihole-local-dns.md](../../../docs/pihole-local-dns.md).

You can also add records in the admin UI: **Local DNS → DNS records**.

## Related

- [docs/pihole-local-dns.md](../../../docs/pihole-local-dns.md)
- [docs/nas-homelab-layout.md](../../../docs/nas-homelab-layout.md)
