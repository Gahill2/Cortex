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

### Tailscale (home + away — no Xfinity router changes)

Works on any phone/PC with Tailscale installed. Pi-hole listens on LAN **and** Tailscale IPs.

1. [Tailscale admin → DNS](https://login.tailscale.com/admin/dns)
2. **Nameservers** → add **`100.104.120.29`** (cortex — check with `tailscale ip -4`)
3. Add a **fallback** nameserver (tried when cortex is off), e.g. **`75.75.75.75`** or **`1.1.1.1`**
4. Turn on **Override local DNS**
5. Keep **MagicDNS** on

On each device: Tailscale app connected → DNS is automatic. No per-device Wi‑Fi DNS needed when Tailscale is running.

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

## Related

- [docs/nas-homelab-layout.md](../../../docs/nas-homelab-layout.md)
