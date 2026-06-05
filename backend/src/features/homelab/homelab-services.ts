import { env } from "../../config/env.js";

export type HomelabServiceCategory = "app" | "media" | "monitoring" | "storage" | "database";

export interface HomelabServiceDef {
  id: string;
  name: string;
  category: HomelabServiceCategory;
  description: string;
  /** HTTP GET for liveness (empty = skip probe). */
  healthUrl: string;
  /** User-facing link (empty = no open button). */
  openUrl: string;
  /** Optional Prometheus job label for container metrics. */
  prometheusJob?: string;
}

function hostFromFrontend(): string {
  try {
    return new URL(env.CORTEX_FRONTEND_URL.replace(/\/$/, "") || "http://127.0.0.1:8080").hostname;
  } catch {
    return "127.0.0.1";
  }
}

function serviceHost(): string {
  return env.HOMELAB_SERVICE_HOST.trim() || hostFromFrontend();
}

function httpService(port: number, path = ""): string {
  return `http://${serviceHost()}:${port}${path}`;
}

function dnsDomain(): string {
  return env.HOMELAB_DNS_DOMAIN.trim().replace(/^\./, "");
}

/** User-facing link when Pi-hole local DNS is configured (jellyfin.cortex, …). */
function friendlyService(subdomain: string, port: number, path = ""): string {
  const domain = dnsDomain();
  if (domain) return `http://${subdomain}.${domain}:${port}${path}`;
  return httpService(port, path);
}

function serviceUrls(
  port: number,
  subdomain: string,
  explicitUrl = "",
  path = ""
): { healthUrl: string; openUrl: string } {
  const health = explicitUrl || httpService(port, path);
  const open = dnsDomain() ? friendlyService(subdomain, port, path) : explicitUrl || httpService(port, path);
  return { healthUrl: health, openUrl: open };
}

function namedService(
  subdomain: string,
  port: number,
  explicitEnv: string,
  path = ""
): { healthUrl: string; openUrl: string } {
  return serviceUrls(port, subdomain, explicitEnv.trim(), path);
}

/** Registered homelab services — URLs from env overrides or tailnet host + default ports. */
export function listHomelabServices(): HomelabServiceDef[] {
  const frontend = env.CORTEX_FRONTEND_URL.replace(/\/$/, "") || "http://127.0.0.1:8080";
  const host = serviceHost();

  const grafana = namedService("grafana", Number(env.HOMELAB_GRAFANA_PORT) || 3000, env.HOMELAB_GRAFANA_URL);
  const prometheus = namedService(
    "prometheus",
    Number(env.HOMELAB_PROMETHEUS_PORT) || 9090,
    env.HOMELAB_PROMETHEUS_URL
  );
  const jellyfin = namedService("jellyfin", Number(env.HOMELAB_JELLYFIN_PORT) || 8096, env.HOMELAB_JELLYFIN_URL);
  const nextcloud = namedService(
    "cloud",
    Number(env.HOMELAB_NEXTCLOUD_PORT) || 8081,
    env.HOMELAB_NEXTCLOUD_URL
  );
  const immich = namedService("photos", Number(env.HOMELAB_IMMICH_PORT) || 2283, env.HOMELAB_IMMICH_URL);
  const pihole = namedService("pihole", Number(env.HOMELAB_PIHOLE_PORT) || 8090, env.HOMELAB_PIHOLE_URL, "/admin/");
  const radarr = serviceUrls(7878, "radarr");
  const sonarr = serviceUrls(8989, "sonarr");
  const prowlarr = serviceUrls(9696, "prowlarr");
  const qbittorrent = serviceUrls(8089, "qbittorrent");
  const sabnzbd = serviceUrls(8082, "sabnzbd");
  const portainerUrl = env.HOMELAB_PORTAINER_URL.trim();

  const services: HomelabServiceDef[] = [
    {
      id: "cortex",
      name: "Cortex",
      category: "app",
      description: "Productivity app (API + web)",
      healthUrl: `${frontend}/api/health/live`,
      openUrl: dnsDomain() ? friendlyService("cortex", 8080) : frontend
    },
    {
      id: "postgres",
      name: "Cortex Postgres",
      category: "database",
      description: "Primary app database (tasks, mail, users)",
      healthUrl: "",
      openUrl: ""
    },
    {
      id: "prometheus",
      name: "Prometheus",
      category: "monitoring",
      description: "Metrics collection",
      healthUrl: `${prometheus.healthUrl.replace(/\/$/, "")}/-/healthy`,
      openUrl: prometheus.openUrl,
      prometheusJob: "prometheus"
    },
    {
      id: "grafana",
      name: "Grafana",
      category: "monitoring",
      description: "Dashboards and graphs",
      healthUrl: `${grafana.healthUrl.replace(/\/$/, "")}/api/health`,
      openUrl: grafana.openUrl
    },
    {
      id: "jellyfin",
      name: "Jellyfin",
      category: "media",
      description: "Media server",
      healthUrl: `${jellyfin.healthUrl.replace(/\/$/, "")}/health`,
      openUrl: jellyfin.openUrl
    },
    {
      id: "radarr",
      name: "Radarr",
      category: "media",
      description: "Movies automation",
      healthUrl: `${radarr.healthUrl}/ping`,
      openUrl: radarr.openUrl
    },
    {
      id: "sonarr",
      name: "Sonarr",
      category: "media",
      description: "TV automation",
      healthUrl: `${sonarr.healthUrl}/ping`,
      openUrl: sonarr.openUrl
    },
    {
      id: "prowlarr",
      name: "Prowlarr",
      category: "media",
      description: "Indexer manager",
      healthUrl: `${prowlarr.healthUrl}/ping`,
      openUrl: prowlarr.openUrl
    },
    {
      id: "qbittorrent",
      name: "qBittorrent",
      category: "media",
      description: "Torrent client (VPN)",
      healthUrl: qbittorrent.healthUrl,
      openUrl: qbittorrent.openUrl
    },
    {
      id: "sabnzbd",
      name: "SABnzbd",
      category: "media",
      description: "Usenet downloader",
      healthUrl: sabnzbd.healthUrl,
      openUrl: sabnzbd.openUrl
    },
    {
      id: "nextcloud",
      name: "Nextcloud",
      category: "storage",
      description: "Files and cloud storage",
      healthUrl: `${nextcloud.healthUrl.replace(/\/$/, "")}/status.php`,
      openUrl: nextcloud.openUrl
    },
    {
      id: "immich",
      name: "Immich",
      category: "media",
      description: "Photo library",
      healthUrl: `${immich.healthUrl.replace(/\/$/, "")}/api/server/ping`,
      openUrl: immich.openUrl
    },
    {
      id: "pihole",
      name: "Pi-hole",
      category: "app",
      description: "DNS ad blocking",
      healthUrl: `${pihole.healthUrl.replace(/\/$/, "")}/admin/`,
      openUrl: pihole.openUrl
    }
  ];

  if (portainerUrl) {
    services.push({
      id: "portainer",
      name: "Portainer",
      category: "app",
      description: "Docker management UI",
      healthUrl: `${portainerUrl.replace(/\/$/, "")}/api/status`,
      openUrl: portainerUrl
    });
  }

  return services;
}

export function getHomelabPrometheusBase(): string | null {
  const url = env.HOMELAB_PROMETHEUS_URL.trim();
  if (url) return url.replace(/\/$/, "");
  const port = Number(env.HOMELAB_PROMETHEUS_PORT) || 9090;
  return `http://${serviceHost()}:${port}`;
}
