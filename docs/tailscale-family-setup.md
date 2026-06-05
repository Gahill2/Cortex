# Witness Protection Program — connect guide (Tailscale)

**Permanent setup guide** — pin this in Discord `#setup` (or your onboarding channel).

The **Witness Protection Program** (WPP) is our invite-only private homelab: movies, files, and photos at home—reachable over Tailscale, not the public internet.

---

## What is the Witness Protection Program?

Two home setups work together on **one private network** (Tailscale):

| Homelab | Role | What you use |
|---------|------|----------------|
| **Greyhill (cortex)** | Main server — runs the apps | Jellyfin, Nextcloud, Immich, DNS (Pi-hole) |
| **Joey’s** | Second home — shares media over Tailscale | Extra movies in Jellyfin (library folder **Joey’s Movies** / `Steve-Movies` on the server) |

You only **connect once** with Tailscale. You do not open Joey’s PC directly — Jellyfin on Greyhill’s server plays his library when his machine is online.

**One tailnet, one invite list** — admins invite you into WPP on Tailscale; then you use the links below (all point at Greyhill’s cortex server).

---

## What is Tailscale?

Tailscale is a small VPN app that puts your phone, laptop, or tablet on a **private network** with the home server—like being on the home Wi‑Fi, but from anywhere.

- No port forwarding on the router  
- Traffic is **encrypted** between your device and the server  
- Only people **you invite** can join  

## Why we use it

| Without Tailscale | With Tailscale |
|-------------------|----------------|
| Services would need to be exposed on the public internet | Services stay on the home PC; only tailnet members can reach them |
| Random IPs and ports to remember | Simple names like `jellyfin.cortex` (with our DNS) |
| Higher risk if something is misconfigured | Access is invite-only |

**You are not “on the public internet” when using Jellyfin or Nextcloud this way**—you are on our private tailnet.

## How it works (one picture)

```text
Your phone ──encrypted──► Tailscale ──encrypted──► Greyhill PC (cortex) ── Jellyfin / Nextcloud / …
                              │                           │
                         [invite only]              Joey’s PC (when on)
                              │                    extra movies over Tailscale
                              └────────────────────────────────┘
```

1. You install Tailscale and accept an **invite** to our tailnet.  
2. You turn **VPN / Connect** on in the Tailscale app.  
3. You open the links below in a browser (or Jellyfin / Nextcloud apps).  
4. The home server sees your device as if it were on the local network.

**Important:** Most apps only work while Tailscale shows **Connected**. Turn it on before opening Jellyfin or Nextcloud.

---

## Step 1 — Get invited (admin does this once per person)

**Admin:** In [Tailscale admin → Users](https://login.tailscale.com/admin/users), invite the person by email, or share a **one-time invite link**.

**Invite link (replace when you generate a new one):**

```text
https://login.tailscale.com/start?invite=YOUR_INVITE_CODE
```

Store the current link in Discord pinned message or a private admin note—regenerate if it leaks.

**New user:** Open the invite link → sign in (Google/Microsoft/email) → install Tailscale when prompted → approve joining the WPP tailnet (name shown on the invite).

---

## Step 2 — Install Tailscale on your device

| Device | Install |
|--------|---------|
| **iPhone / iPad** | [App Store — Tailscale](https://apps.apple.com/app/tailscale/id1470499037) |
| **Android** | [Play Store — Tailscale](https://play.google.com/store/apps/details?id=com.tailscale.ipn) |
| **Windows** | [tailscale.com/download/windows](https://tailscale.com/download/windows) |
| **Mac** | [tailscale.com/download/mac](https://tailscale.com/download/mac) |
| **Linux** | [tailscale.com/download/linux](https://tailscale.com/download/linux) |

After install: log in with the **same account** you used for the invite.

---

## Step 3 — Connect

1. Open the **Tailscale** app.  
2. Turn **Connect** on (VPN icon should show active).  
3. Leave **Use Tailscale DNS** enabled (default)—this enables friendly names and ad blocking on the tailnet.

**iPhone tips**

- Allow VPN configuration when iOS asks.  
- Settings → **Tailscale** → enable VPN; keep app logged in.  
- For fewer ads in browsers: Settings → Apple ID → iCloud → **Private Relay** off while testing; Wi‑Fi → DNS → **Automatic**.

**Android tips**

- Settings → Network → **Private DNS** → **Off** (otherwise Pi-hole DNS may be bypassed).

---

## Step 4 — Open the services (bookmarks)

Use these in **Safari, Chrome, or Firefox** while Tailscale is connected.

### Everyone (movies, files, photos)

| Service | Link | Login |
|---------|------|--------|
| **Movies & TV (Jellyfin)** | http://jellyfin.cortex:8096 | Account created for you (ask admin) |
| **Files (Nextcloud)** | http://cloud.cortex:8081 | Username + password from admin |
| **Photos (Immich)** *(optional)* | http://photos.cortex:2283 | Account from admin |

**If `.cortex` names do not load**, use the Tailscale IP instead (admin will post current IP in Discord):

```text
Movies:  http://100.104.120.29:8096
Files:   http://100.104.120.29:8081
Photos:  http://100.104.120.29:2283
```

### Admin only (do not share in #setup)

| Service | Link |
|---------|------|
| Cortex app | https://cortex.tail4f977b.ts.net |
| Downloads (*arr, torrents) | See `docs/homelab-admin-access.md` in repo |

---

## Jellyfin app (optional)

1. Install **Jellyfin** from the app store.  
2. Add server: `http://jellyfin.cortex:8096` (or the IP URL above).  
3. Sign in with your Jellyfin username/password.

---

## Nextcloud app (optional)

1. Install **Nextcloud** from the app store.  
2. Server URL: `http://cloud.cortex:8081`  
3. Log in with the **non-admin** account admin gave you.

---

## Troubleshooting

| Problem | Try this |
|---------|----------|
| Page does not load | Tailscale **Connected**? Try the `100.x.x.x` links from Discord. |
| “Untrusted domain” (Nextcloud) | Tell admin; they run `npm run nas:nextcloud:trusted-domains` |
| Jellyfin plays but buffers | Wi‑Fi weak or server busy; try lower quality in player |
| Some movies missing | Joey’s PC may be off — his titles only appear when his homelab is online |
| Still see lots of ads (phone) | Use Tailscale DNS; disable Private DNS (Android) / Private Relay (iOS) |
| Forgot Jellyfin password | Ask admin to reset in Jellyfin → Users |
| Forgot Nextcloud password | Ask admin to reset in Nextcloud → Users |

**Still stuck?** Post in Discord with: device (iPhone/Android/PC), whether Tailscale shows Connected, and the exact URL you opened (no passwords).

---

## For admins (maintaining this guide)

| Task | Command / link |
|------|----------------|
| Check Tailscale DNS → Pi-hole | `npm run nas:pihole:tailscale-dns` |
| Update DNS names after IP change | `npm run nas:pihole:tailscale-dns:sync` then `npm run nas:pihole:local-dns` |
| Create Nextcloud family user | `npm run nas:nextcloud:user -- --user NAME --password '…'` |
| Full admin URLs & passwords | `docs/homelab-admin-access.md` |
| Pi-hole / friendly DNS | `docs/pihole-local-dns.md` |

**Discord `#setup` pin checklist**

1. Paste the **invite link** (Step 1) when you create it.  
2. Pin this doc’s **Step 2–4** (or link to this file on GitHub if the repo is accessible).  
3. Post the **fallback IP links** when the home IP changes.  
4. Do **not** post admin passwords or torrent stack links in the public channel.

---

## Repo path

This file lives at: `docs/tailscale-family-setup.md` in the Cortex repository.
