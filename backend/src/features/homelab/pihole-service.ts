import { env } from "../../config/env.js";

const PROBE_MS = 8000;

export interface HomelabPiholeStatus {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  adminUrl: string;
  queriesToday: number | null;
  blockedToday: number | null;
  percentBlocked: number | null;
  domainsBlocked: number | null;
  activeClients: number | null;
  /** Pi-hole container RAM is tiny (~10–20 MB); host memory % comes from Host metrics. */
  memoryNote: string;
  message?: string;
}

function piholePort(): number {
  return Number(env.HOMELAB_PIHOLE_PORT) || 8090;
}

/** API probe URL (Tailscale/LAN IP — works from the API container). */
function piholeBaseUrl(): string {
  const explicit = env.HOMELAB_PIHOLE_URL.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = env.HOMELAB_SERVICE_HOST.trim() || "127.0.0.1";
  return `http://${host}:${piholePort()}`;
}

/** Link shown in Homelab UI when Pi-hole local DNS is configured. */
function piholeAdminOpenUrl(): string {
  const domain = env.HOMELAB_DNS_DOMAIN.trim().replace(/^\./, "");
  if (domain) return `http://pihole.${domain}:${piholePort()}/admin/`;
  return `${piholeBaseUrl()}/admin/`;
}

/** Pi-hole v6: use X-FTL-SID (cookie-only needs X-FTL-CSRF). */
async function piholeSession(baseUrl: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(PROBE_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { session?: { sid?: string; valid?: boolean } };
    if (!json.session?.valid || !json.session.sid) return null;
    return json.session.sid;
  } catch {
    return null;
  }
}

function piholeApiHeaders(sid: string): HeadersInit {
  return { "X-FTL-SID": sid };
}

export async function getPiholeStatus(): Promise<HomelabPiholeStatus> {
  const baseUrl = piholeBaseUrl();
  const adminUrl = piholeAdminOpenUrl();
  const password = env.HOMELAB_PIHOLE_API_PASSWORD.trim();
  const memoryNote =
    "Pi-hole uses ~10–20 MB RAM. The Memory % on this page is whole-PC usage (Immich, Nextcloud, etc.), not Pi-hole.";

  if (!password) {
    return {
      configured: false,
      connected: false,
      baseUrl,
      adminUrl,
      queriesToday: null,
      blockedToday: null,
      percentBlocked: null,
      domainsBlocked: null,
      activeClients: null,
      memoryNote,
      message: "Set HOMELAB_PIHOLE_API_PASSWORD in api.env (same as Pi-hole admin password)",
    };
  }

  const sid = await piholeSession(baseUrl, password);
  if (!sid) {
    return {
      configured: true,
      connected: false,
      baseUrl,
      adminUrl,
      queriesToday: null,
      blockedToday: null,
      percentBlocked: null,
      domainsBlocked: null,
      activeClients: null,
      memoryNote,
      message: "Could not authenticate with Pi-hole — check URL and password",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/stats/summary`, {
      headers: piholeApiHeaders(sid),
      signal: AbortSignal.timeout(PROBE_MS),
    });
    if (!res.ok) {
      return {
        configured: true,
        connected: false,
        baseUrl,
        adminUrl,
        queriesToday: null,
        blockedToday: null,
        percentBlocked: null,
        domainsBlocked: null,
        activeClients: null,
        memoryNote,
        message: `Pi-hole API HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as {
      queries?: {
        total?: number;
        blocked?: number;
        percent_blocked?: number;
      };
      clients?: { active?: number };
      gravity?: { domains_being_blocked?: number };
    };

    const queries = json.queries;
    const blocked = queries?.blocked ?? null;
    const total = queries?.total ?? null;
    const pct = queries?.percent_blocked ?? null;

    return {
      configured: true,
      connected: true,
      baseUrl,
      adminUrl,
      queriesToday: total,
      blockedToday: blocked,
      percentBlocked: pct != null ? Math.round(pct * 10) / 10 : null,
      domainsBlocked: json.gravity?.domains_being_blocked ?? null,
      activeClients: json.clients?.active ?? null,
      memoryNote,
    };
  } catch (e) {
    return {
      configured: true,
      connected: false,
      baseUrl,
      adminUrl,
      queriesToday: null,
      blockedToday: null,
      percentBlocked: null,
      domainsBlocked: null,
      activeClients: null,
      memoryNote,
      message: e instanceof Error ? e.message : "Pi-hole unreachable",
    };
  }
}
