import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { getHomelabPrometheusBase, listHomelabServices, type HomelabServiceDef } from "./homelab-services.js";
import { getCloudStatus, type CloudQuota, type CloudStatus } from "../nextcloud/nextcloud-service.js";

export type ServiceHealth = "ok" | "warn" | "down" | "unknown" | "skipped";

export interface HomelabServiceStatus {
  id: string;
  name: string;
  category: HomelabServiceDef["category"];
  description: string;
  health: ServiceHealth;
  latencyMs: number | null;
  openUrl: string;
  message?: string;
}

export interface HomelabMetrics {
  available: boolean;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  message?: string;
}

export interface HomelabDatabaseStatus {
  connected: boolean;
  provider: string;
  host: string;
  database: string;
  user: string;
  taskCount: number | null;
  mailAccountCount: number | null;
  message?: string;
}

export interface HomelabCloudStorage {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  username: string;
  quota: CloudQuota | null;
  message?: string;
}

export interface HomelabStatusPayload {
  overview: ReturnType<typeof getHomelabOverview>;
  services: HomelabServiceStatus[];
  metrics: HomelabMetrics;
  database: HomelabDatabaseStatus;
  cloud: HomelabCloudStorage;
}

const PROBE_MS = 5000;

async function probeUrl(url: string): Promise<{ health: ServiceHealth; latencyMs: number; message?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_MS),
      redirect: "follow"
    });
    const latencyMs = Date.now() - t0;
    if (res.ok) return { health: "ok", latencyMs };
    return { health: "warn", latencyMs, message: `HTTP ${res.status}` };
  } catch (e) {
    return {
      health: "down",
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : "Unreachable"
    };
  }
}

export async function checkHomelabServices(): Promise<HomelabServiceStatus[]> {
  const defs = listHomelabServices();
  const results: HomelabServiceStatus[] = [];

  for (const def of defs) {
    if (def.id === "postgres") {
      const db = await getDatabaseStatus();
      results.push({
        id: def.id,
        name: def.name,
        category: def.category,
        description: def.description,
        health: db.connected ? "ok" : "down",
        latencyMs: null,
        openUrl: def.openUrl,
        message: db.connected ? undefined : db.message
      });
      continue;
    }

    if (!def.healthUrl) {
      results.push({
        id: def.id,
        name: def.name,
        category: def.category,
        description: def.description,
        health: "skipped",
        latencyMs: null,
        openUrl: def.openUrl
      });
      continue;
    }

    const probe = await probeUrl(def.healthUrl);
    results.push({
      id: def.id,
      name: def.name,
      category: def.category,
      description: def.description,
      health: probe.health,
      latencyMs: probe.latencyMs,
      openUrl: def.openUrl,
      message: probe.message
    });
  }

  return results;
}

async function prometheusScalar(query: string): Promise<number | null> {
  const base = getHomelabPrometheusBase();
  if (!base) return null;
  const url = `${base}/api/v1/query?query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_MS) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { result?: Array<{ value?: [number, string] }> };
    };
    const raw = json.data?.result?.[0]?.value?.[1];
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  } catch {
    return null;
  }
}

export async function getHomelabMetrics(): Promise<HomelabMetrics> {
  const base = getHomelabPrometheusBase();
  if (!base) {
    return { available: false, cpuPercent: null, memoryPercent: null, diskPercent: null, message: "Prometheus URL not configured" };
  }

  const probe = await probeUrl(`${base}/-/healthy`);
  if (probe.health !== "ok") {
    return {
      available: false,
      cpuPercent: null,
      memoryPercent: null,
      diskPercent: null,
      message: probe.message ?? "Prometheus unreachable"
    };
  }

  const cpuPercent = await prometheusScalar(
    '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
  );
  const memoryPercent = await prometheusScalar(
    "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"
  );
  const diskPercent = await prometheusScalar(
    '(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="rootfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"})) * 100'
  );

  return { available: true, cpuPercent, memoryPercent, diskPercent };
}

function parseDatabaseUrl(): { host: string; database: string; user: string; provider: string } {
  const raw = process.env.DATABASE_URL || "";
  try {
    const u = new URL(raw.replace(/^postgresql:/, "http:"));
    return {
      provider: "postgresql",
      host: u.hostname + (u.port ? `:${u.port}` : ""),
      database: u.pathname.replace(/^\//, "") || "cortex",
      user: u.username || "cortex"
    };
  } catch {
    return { provider: "postgresql", host: "unknown", database: "cortex", user: "cortex" };
  }
}

export async function getDatabaseStatus(): Promise<HomelabDatabaseStatus> {
  const meta = parseDatabaseUrl();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [taskRow, mailRow] = await Promise.all([
      prisma.task.count().catch(() => null),
      prisma.mailAccount.count().catch(() => null)
    ]);
    return {
      connected: true,
      ...meta,
      taskCount: taskRow,
      mailAccountCount: mailRow
    };
  } catch (e) {
    return {
      connected: false,
      ...meta,
      taskCount: null,
      mailAccountCount: null,
      message: e instanceof Error ? e.message : "Database unreachable"
    };
  }
}

export function getHomelabOverview() {
  return {
    host: env.HOMELAB_SERVICE_HOST.trim() || hostFromEnv(),
    frontendUrl: env.CORTEX_FRONTEND_URL.replace(/\/$/, ""),
    prometheusUrl: getHomelabPrometheusBase(),
    grafanaUrl: env.HOMELAB_GRAFANA_URL.trim() || null
  };
}

function hostFromEnv(): string {
  try {
    return new URL(env.CORTEX_FRONTEND_URL.replace(/\/$/, "") || "http://127.0.0.1").hostname;
  } catch {
    return "127.0.0.1";
  }
}

export async function getCloudStorageStatus(): Promise<HomelabCloudStorage> {
  const status: CloudStatus = await getCloudStatus();
  return {
    configured: status.configured,
    connected: status.connected,
    baseUrl: status.baseUrl,
    username: status.username,
    quota: status.quota,
    message: status.message
  };
}
