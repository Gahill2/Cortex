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

/** Registered homelab services — URLs from env overrides or tailnet host + default ports. */
export function listHomelabServices(): HomelabServiceDef[] {
  const frontend = env.CORTEX_FRONTEND_URL.replace(/\/$/, "") || "http://127.0.0.1:8080";
  const host = serviceHost();

  const grafanaUrl = env.HOMELAB_GRAFANA_URL.trim() || httpService(Number(env.HOMELAB_GRAFANA_PORT) || 3000);
  const prometheusUrl =
    env.HOMELAB_PROMETHEUS_URL.trim() || httpService(Number(env.HOMELAB_PROMETHEUS_PORT) || 9090);
  const jellyfinUrl = env.HOMELAB_JELLYFIN_URL.trim() || httpService(Number(env.HOMELAB_JELLYFIN_PORT) || 8096);
  const nextcloudUrl =
    env.HOMELAB_NEXTCLOUD_URL.trim() || httpService(Number(env.HOMELAB_NEXTCLOUD_PORT) || 8081);
  const immichUrl = env.HOMELAB_IMMICH_URL.trim() || httpService(Number(env.HOMELAB_IMMICH_PORT) || 2283);
  const piholeUrl = env.HOMELAB_PIHOLE_URL.trim() || httpService(Number(env.HOMELAB_PIHOLE_PORT) || 8090);
  const portainerUrl = env.HOMELAB_PORTAINER_URL.trim();

  const services: HomelabServiceDef[] = [
    {
      id: "cortex",
      name: "Cortex",
      category: "app",
      description: "Productivity app (API + web)",
      healthUrl: `${frontend}/api/health/live`,
      openUrl: frontend
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
      healthUrl: `${prometheusUrl.replace(/\/$/, "")}/-/healthy`,
      openUrl: prometheusUrl,
      prometheusJob: "prometheus"
    },
    {
      id: "grafana",
      name: "Grafana",
      category: "monitoring",
      description: "Dashboards and graphs",
      healthUrl: `${grafanaUrl.replace(/\/$/, "")}/api/health`,
      openUrl: grafanaUrl
    },
    {
      id: "jellyfin",
      name: "Jellyfin",
      category: "media",
      description: "Media server",
      healthUrl: `${jellyfinUrl.replace(/\/$/, "")}/health`,
      openUrl: jellyfinUrl
    },
    {
      id: "nextcloud",
      name: "Nextcloud",
      category: "storage",
      description: "Files and cloud storage",
      healthUrl: `${nextcloudUrl.replace(/\/$/, "")}/status.php`,
      openUrl: nextcloudUrl
    },
    {
      id: "immich",
      name: "Immich",
      category: "media",
      description: "Photo library",
      healthUrl: `${immichUrl.replace(/\/$/, "")}/api/server/ping`,
      openUrl: immichUrl
    },
    {
      id: "pihole",
      name: "Pi-hole",
      category: "app",
      description: "DNS ad blocking",
      healthUrl: `${piholeUrl.replace(/\/$/, "")}/admin/`,
      openUrl: `${piholeUrl.replace(/\/$/, "")}/admin/`
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
