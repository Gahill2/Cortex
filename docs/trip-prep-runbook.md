# Trip prep runbook — Tailscale DNS + Jellyfin

One page to get the homelab travel-ready. Goal state:

- **Normal internet works everywhere**, even with Tailscale connected.
- **Private services** (Jellyfin, Nextcloud, *arr, Pi-hole admin…) are reachable **only** over Tailscale, via friendly `.cortex` names.
- **Jellyfin healthy** and playable from a phone away from home, including AirPlay to a TV.

Run everything below **on the cortex server** (the homelab PC), except the Tailscale admin steps which happen in the browser.

---

## 1) Fix tailnet DNS → Split DNS (5 minutes, one time)

**Symptom being fixed:** with Tailscale on, Jellyfin works but the rest of the internet doesn't. Cause: the tailnet uses Pi-hole (`100.104.120.29`) as a **global** DNS override, so every device's entire DNS depends on the home box being up.

**In [Tailscale admin → DNS](https://login.tailscale.com/admin/dns):**

1. Keep **MagicDNS** on.
2. Under **Nameservers**, delete the existing global custom nameserver `100.104.120.29` (and any `1.1.1.1` fallback added for it).
3. Turn **Override local DNS** **off**.
4. **Add custom nameserver** → `100.104.120.29` → toggle **Restrict to domain** (Split DNS) → domain: `cortex`.

Result: only `*.cortex` lookups travel to Pi-hole over Tailscale; every other website resolves through each device's normal DNS. Nothing on the public internet points at your services — they remain tailnet-only.

**Also check per device:** in the Tailscale app, make sure **no exit node** is selected (Exit node → None). An exit node routes *all* traffic through home and is the other classic "internet is broken on VPN" cause.

**Verify (on the server):**

```bash
npm run nas:pihole:tailscale-dns        # Pi-hole up, listening on the TS IP
# If the Tailscale IP ever changes:
npm run nas:pihole:tailscale-dns:sync && npm run nas:pihole:local-dns
```

**Verify (on your phone, cellular + Tailscale on):**

- `http://jellyfin.cortex:8096` loads ✅
- Random website (nytimes.com) loads ✅
- Tailscale **off** → `jellyfin.cortex` does **not** load ✅ (that's the "safe without Tailscale" guarantee)

---

## 2) Jellyfin health check (before you leave)

```bash
# 1. Stack up (Jellyfin, Nextcloud, …)
npm run nas:up

# 2. Friendly server name instead of the Docker hash (JELLYFIN_SERVER_NAME in deploy/nas/.env)
npm run nas:jellyfin:server-name

# 3. Make sure clients get playable URLs: in deploy/nas/.env set
#    JELLYFIN_PUBLISHED_URL=http://jellyfin.cortex:8096
#    then:
npm run nas:jellyfin:recreate

# 4. Library paths + fresh scan
npm run nas:jellyfin:library-paths
npm run nas:jellyfin:restart-scan

# 5. If Joey's remote library should be available while you're away:
npm run nas:remote-storage:mount
npm run nas:jellyfin:link-remote
```

Then in **Jellyfin Dashboard** (`http://jellyfin.cortex:8096` → Dashboard):

- **Playback → Transcoding**: hardware acceleration set (or at least working software transcode) — away-from-home streams often need transcoding for hotel bandwidth.
- **Users**: your account (and anyone traveling with you) can sign in.
- Play one movie start-to-finish from a phone on **cellular** with Tailscale on. That's the real end-to-end test.

Don't enable UPnP/port-forwarding "remote access" in Jellyfin — Tailscale already provides remote access privately.

---

## 3) Links (bookmark these)

Everything requires **Tailscale connected**. IP fallback if `.cortex` names fail: replace host with `100.104.120.29`.

### Everyday

| Service | URL |
|---------|-----|
| **Jellyfin (movies/TV)** | http://jellyfin.cortex:8096 |
| Nextcloud (files) | http://cloud.cortex:8081 |
| Immich (photos) | http://photos.cortex:2283 |
| Cortex app | https://cortex.tail4f977b.ts.net |

### Admin

| Service | URL |
|---------|-----|
| Cortex web (homelab UI) | http://cortex.cortex:8080 |
| Radarr | http://radarr.cortex:7878 |
| Sonarr | http://sonarr.cortex:8989 |
| Prowlarr | http://prowlarr.cortex:9696 |
| qBittorrent | http://qbittorrent.cortex:8089 |
| SABnzbd | http://sabnzbd.cortex:8082 |
| Pi-hole | http://pihole.cortex:8090/admin/ |
| Grafana | http://grafana.cortex:3000 |
| Prometheus | http://prometheus.cortex:9090 |
| Tailscale admin | https://login.tailscale.com/admin/machines |

---

## 4) AirPlay from Jellyfin

AirPlay comes from the **client app on your iPhone/iPad**, not from the Jellyfin server — no server install needed.

1. Install the official **Jellyfin** iOS app (or **Swiftfin**). Add server `http://jellyfin.cortex:8096`, sign in.
2. Start playing a video → tap the **AirPlay icon** in the player → pick the Apple TV / AirPlay TV.
3. Your phone pulls the stream from home over Tailscale and hands it to the TV.

**On a trip, the gotcha is the TV's network, not Jellyfin:**

- Phone and the AirPlay target must be on the **same Wi‑Fi** (hotel/Airbnb network). Tailscale on the phone is fine — AirPlay discovery stays local.
- Hotel Wi‑Fi often has **AP/client isolation**, which blocks AirPlay entirely. Workarounds: Apple TV **peer-to-peer AirPlay** (works without shared Wi‑Fi on Apple TV HD/4K), a travel router, or the reliable fallback — a **Lightning/USB-C → HDMI adapter** and a spare HDMI cable in your bag.
- Airbnb with a smart TV: many Rokus/Fire TVs have a native **Jellyfin app** — installing that and pointing it at the server only works if the TV itself can join the tailnet (it can't, normally), so for guest TVs AirPlay/HDMI from the phone is the way.

---

## Pre-trip checklist

- [ ] Split DNS set in Tailscale admin; global override + "Override local DNS" removed
- [ ] No exit node selected on phones/laptops
- [ ] `npm run nas:pihole:tailscale-dns` clean
- [ ] `npm run nas:up` + `npm run nas:jellyfin:restart-scan` clean
- [ ] `JELLYFIN_PUBLISHED_URL` set; server name set
- [ ] Full movie played over cellular + Tailscale
- [ ] AirPlay tested at home (Jellyfin iOS app → Apple TV)
- [ ] HDMI adapter packed (hotel Wi‑Fi insurance)
- [ ] Auto-updates/reboots on the server disabled or scheduled safely while away
