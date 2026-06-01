# RustDesk over Tailscale — faster remote desktop

Use this when remoting into the **cortex** PC feels laggy (high latency, blurry updates, stutter).

## Connect the fast way

1. Both devices on the **same Tailnet**.
2. In RustDesk on your laptop/phone, connect to the host’s **Tailscale IP** (not the public ID relay):
   - `100.104.120.29` (check with `tailscale ip -4` on the host)
3. Prefer **Direct IP Access** with permanent password (already configured on this machine).

Avoid routing through `rs-ny.rustdesk.com` when Tailscale direct works — relay adds latency.

## Host settings (cortex PC)

Open RustDesk → **Settings → Security**

- Permanent password set
- **Enable unattended access**
- **Direct IP Access** enabled

**Settings → Display / Performance** (names vary by version)

- Image quality: **Balanced** or **Low** for slow links (not “Best”)
- Disable **show remote wallpaper** if available
- Prefer **H.264 / hardware codec**; turn off **AV1 test** if video stutters

Optional Ubuntu host tweaks:

```bash
# Reduce compositor work while remoting
gsettings set org.gnome.desktop.interface enable-animations false
```

Re-enable animations when done if you prefer them locally.

## Client settings (your laptop)

- Close heavy browser tabs on the **client** — RustDesk + Chrome competes for encode/decode.
- Use **full screen** or fixed window size (constant resolution helps encoders).
- Wired Ethernet or strong Wi‑Fi on both ends beats Tailscale over weak mobile data.

## Apply recommended config (host)

From the Cortex repo on the cortex PC:

```bash
npm run rustdesk:tune
```

This updates `~/.config/rustdesk/RustDesk2.toml` options for direct Tailscale use (no secrets committed).

## Firewall

RustDesk ports only need to be open on **`tailscale0`** if you use UFW — see the RustDesk install notes in your chat history. LAN (`10.0.0.x`) is separate from Tailscale (`100.x`).

## Cortex UI while remoted

- Use **Chrome** for Cortex (`https://cortex.tail4f977b.ts.net:8080`), not Cursor’s built-in browser.
- **Tasks & Calendar** defers AI “focus” suggestions by ~1s so the page stays responsive over slow RDP.

## Still slow?

| Symptom | Try |
|--------|-----|
| Black screen | Host awake? `systemctl status rustdesk` |
| Connects then freezes | Lower quality; check `tailscale ping 100.104.120.29` |
| Good ping, bad video | Disable AV1; enable hardware encoding on host |
| Only Cortex web slow | Not RustDesk — check API health `/api/health` |
