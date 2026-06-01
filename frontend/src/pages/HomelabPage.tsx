import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Stethoscope,
  Terminal,
} from "lucide-react";
import { api } from "../api/client";
import { AIProviderBanner } from "../components/ai/AIProviderBanner";
import { useAIStatus } from "../hooks/useAIStatus";
import { CHAT_AI_PROVIDER_LABELS } from "../lib/aiProvider";

type ServiceHealth = "ok" | "warn" | "down" | "unknown" | "skipped";

interface HomelabServiceStatus {
  id: string;
  name: string;
  category: string;
  description: string;
  health: ServiceHealth;
  latencyMs: number | null;
  openUrl: string;
  message?: string;
}

interface HomelabMetrics {
  available: boolean;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  message?: string;
}

interface HomelabDatabaseStatus {
  connected: boolean;
  provider: string;
  host: string;
  database: string;
  user: string;
  taskCount: number | null;
  mailAccountCount: number | null;
  message?: string;
}

interface HomelabCloudStorage {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  username: string;
  quota: {
    usedHuman: string;
    totalHuman: string;
    usedPercent: number | null;
  } | null;
  message?: string;
}

interface HostDiskUsage {
  mount: string;
  label: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  totalHuman: string;
  usedHuman: string;
  freeHuman: string;
}

interface NasFolderUsage {
  name: string;
  sizeBytes: number;
  sizeHuman: string;
}

interface HostStorageStatus {
  available: boolean;
  systemDisk: HostDiskUsage | null;
  nasRoot: string | null;
  nasTotalBytes: number | null;
  nasTotalHuman: string | null;
  nasFolders: NasFolderUsage[];
  downloadHeadroomHuman: string | null;
  message?: string;
}

interface HomelabStatusPayload {
  overview: {
    host: string;
    frontendUrl: string;
    prometheusUrl: string | null;
    grafanaUrl: string | null;
  };
  services: HomelabServiceStatus[];
  metrics: HomelabMetrics;
  database: HomelabDatabaseStatus;
  cloud?: HomelabCloudStorage;
  storage?: HostStorageStatus;
  pihole?: HomelabPiholeStatus;
  icloud?: HomelabIcloudStatus;
}

interface HomelabPiholeStatus {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  adminUrl: string;
  queriesToday: number | null;
  blockedToday: number | null;
  percentBlocked: number | null;
  domainsBlocked: number | null;
  activeClients: number | null;
  memoryNote: string;
  message?: string;
}

interface HomelabIcloudStatus {
  configured: boolean;
  authenticated: boolean;
  appleId: string;
  importPath: string;
  importSizeHuman: string | null;
  importFileCount: number | null;
  immichUrl: string;
  message?: string;
  setupHint?: string;
}

function healthLabel(h: ServiceHealth): string {
  switch (h) {
    case "ok":
      return "Healthy";
    case "warn":
      return "Degraded";
    case "down":
      return "Down";
    case "skipped":
      return "N/A";
    default:
      return "Unknown";
  }
}

function StorageBar({
  label,
  usedHuman,
  totalHuman,
  freeHuman,
  usedPercent,
  hint,
}: {
  label: string;
  usedHuman: string;
  totalHuman: string;
  freeHuman: string;
  usedPercent: number;
  hint?: string;
}) {
  const tone = usedPercent >= 90 ? "critical" : usedPercent >= 75 ? "warn" : "ok";
  return (
    <div className="homelab-storage-block">
      <div className="homelab-storage-block__head">
        <span className="homelab-storage-block__label">{label}</span>
        <span className="homelab-storage-block__stats">
          {usedHuman} used · {freeHuman} free · {totalHuman} total
        </span>
      </div>
      <div
        className="homelab-storage-bar"
        data-tone={tone}
        role="progressbar"
        aria-valuenow={usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="homelab-storage-bar__fill" style={{ width: `${Math.min(usedPercent, 100)}%` }} />
      </div>
      {hint ? <p className="homelab-hint homelab-storage-hint">{hint}</p> : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit = "%",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <article className="homelab-metric">
      <div className="homelab-metric__icon">{icon}</div>
      <p className="homelab-metric__label">{label}</p>
      <p className="homelab-metric__value">{value != null ? `${value}${unit}` : "—"}</p>
    </article>
  );
}

export function HomelabPage() {
  const [data, setData] = useState<HomelabStatusPayload | null>(null);
  const { status: aiStatus, loading: aiStatusLoading, refresh: refreshAi } = useAIStatus();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);
  const [deployNeedsFix, setDeployNeedsFix] = useState(false);
  const [listenerOk, setListenerOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data?: HomelabStatusPayload }>("/homelab/status");
      setData(r.data?.data ?? null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Could not load homelab status";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<{ data?: { available?: boolean } }>("/homelab/deploy/status");
        setListenerOk(Boolean(r.data?.data?.available));
      } catch {
        setListenerOk(false);
      }
    })();
  }, []);

  const runDeploy = async () => {
    setDeployBusy(true);
    setDeployMsg(null);
    setDeployNeedsFix(false);
    try {
      const r = await api.post<{ data?: { ok?: boolean; needsFix?: boolean; output?: string; fixCommand?: string } }>(
        "/homelab/deploy",
      );
      const result = r.data?.data;
      setDeployNeedsFix(Boolean(result?.needsFix));
      if (result?.ok) {
        setDeployMsg("Deploy finished. Refreshing status…");
        await load();
      } else {
        setDeployMsg(result?.output?.slice(-800) ?? "Deploy failed");
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } } };
      setDeployMsg(ax.response?.data?.error?.message ?? "Deploy request failed");
    } finally {
      setDeployBusy(false);
    }
  };

  const runDoctor = async () => {
    setDeployBusy(true);
    setDeployMsg(null);
    setDeployNeedsFix(false);
    try {
      const r = await api.post<{ data?: { ok?: boolean; needsFix?: boolean; output?: string } }>(
        "/homelab/deploy/doctor",
      );
      const result = r.data?.data;
      setDeployNeedsFix(Boolean(result?.needsFix));
      setDeployMsg(result?.output?.split("\n").slice(-6).join("\n") ?? (result?.ok ? "Docker OK" : "Check failed"));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } } };
      setDeployMsg(ax.response?.data?.error?.message ?? "Doctor request failed");
    } finally {
      setDeployBusy(false);
    }
  };

  const copyFixCommand = () => {
    void navigator.clipboard.writeText("npm run server:docker:fix-once");
  };

  const openUrl = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const grafanaUrl =
    data?.overview.grafanaUrl ||
    data?.services.find((s) => s.id === "grafana")?.openUrl ||
    null;

  return (
    <div className="page homelab-page">
      <div className="page-titlebar homelab-page__head">
        <div>
          <h1 className="page-title">Homelab</h1>
          <p className="page-subtitle">
            Storage, Pi-hole, iCloud photos, system health, and links to Jellyfin, Nextcloud, and more.
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm homelab-refresh" onClick={() => { void load(); void refreshAi(); }} disabled={loading}>
          <RefreshCw size={16} className={loading ? "homelab-spin" : undefined} aria-hidden />
          Refresh
        </button>
      </div>

      {error && (
        <p className="homelab-error" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="homelab-loading">
          <div className="page-loading-spinner" aria-hidden />
          <p>Checking services…</p>
        </div>
      ) : data ? (
        <div className="homelab-page__body">
          <section className="homelab-section homelab-section--deploy" aria-labelledby="homelab-deploy-title">
            <div className="homelab-section__head">
              <h2 id="homelab-deploy-title" className="homelab-section__title">
                <Rocket size={18} aria-hidden />
                Deploy Cortex
              </h2>
            </div>
            <p className="homelab-hint">
              Rebuild API + web from the latest code on this PC. Auto-deploy also runs every 2 minutes when files change
              {listenerOk === false ? " (deploy listener not running — run npm run server:deploy:setup on the hub)" : ""}.
            </p>
            <div className="homelab-deploy-actions">
              <button type="button" className="btn-primary btn-sm" onClick={() => void runDeploy()} disabled={deployBusy}>
                <Rocket size={16} aria-hidden />
                {deployBusy ? "Working…" : "Redeploy now"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => void runDoctor()} disabled={deployBusy}>
                <Stethoscope size={16} aria-hidden />
                Check Docker
              </button>
            </div>
            {deployMsg ? (
              <pre className="homelab-deploy-output" role="status">
                {deployMsg}
              </pre>
            ) : null}
            {deployNeedsFix ? (
              <div className="homelab-deploy-fix">
                <p>
                  <Terminal size={16} aria-hidden /> One-time fix on the cortex PC (needs your password in terminal):
                </p>
                <code className="homelab-deploy-fix__cmd">npm run server:docker:fix-once</code>
                <button type="button" className="btn-ghost btn-sm" onClick={copyFixCommand}>
                  Copy command
                </button>
              </div>
            ) : null}
          </section>

          <section className="homelab-section" aria-labelledby="homelab-ai-title">
            <h2 id="homelab-ai-title" className="homelab-section__title">
              <Sparkles size={18} aria-hidden />
              AI providers
            </h2>
            <AIProviderBanner status={aiStatus} loading={aiStatusLoading} />
            {aiStatus?.providers?.length ? (
              <ul className="homelab-ai-providers">
                {aiStatus.providers.map((p) => {
                  const state =
                    p.id === "ollama"
                      ? p.available
                        ? "Running"
                        : "Not running"
                      : p.available
                        ? "Configured"
                        : "Not set";
                  return (
                  <li key={p.id} className="homelab-ai-providers__item" data-available={p.available}>
                    <span className="homelab-ai-providers__name">{CHAT_AI_PROVIDER_LABELS[p.id]}</span>
                    <span className="homelab-ai-providers__model">{p.model}</span>
                    <span className="homelab-ai-providers__state">{state}</span>
                  </li>
                  );
                })}
              </ul>
            ) : null}
            {aiStatus && !aiStatus.ollama ? (
              <p className="homelab-hint">
                Free local AI: run <code>npm run server:ollama:setup</code> on this PC (requires sudo once), then redeploy API.
              </p>
            ) : null}
          </section>

          {data.storage?.available && data.storage.systemDisk && (
            <section className="homelab-section homelab-section--storage" aria-labelledby="homelab-storage-title">
              <h2 id="homelab-storage-title" className="homelab-section__title">
                <HardDrive size={18} aria-hidden />
                Storage on this PC
              </h2>
              <StorageBar
                label={data.storage.systemDisk.label}
                usedHuman={data.storage.systemDisk.usedHuman}
                totalHuman={data.storage.systemDisk.totalHuman}
                freeHuman={data.storage.systemDisk.freeHuman}
                usedPercent={data.storage.systemDisk.usedPercent}
                hint={
                  data.storage.downloadHeadroomHuman
                    ? `You have about ${data.storage.downloadHeadroomHuman} free before the disk fills up.`
                    : undefined
                }
              />
              {data.storage.nasFolders.length > 0 && (
                <div className="homelab-nas-folders">
                  <p className="homelab-nas-folders__title">
                    NAS folders
                    {data.storage.nasTotalHuman ? ` · ${data.storage.nasTotalHuman} tracked` : ""}
                  </p>
                  <ul className="homelab-nas-folders__list">
                    {data.storage.nasFolders.map((folder) => (
                      <li key={folder.name} className="homelab-nas-folders__item">
                        <span className="homelab-nas-folders__name">{folder.name}</span>
                        <span className="homelab-nas-folders__size">{folder.sizeHuman}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.storage.message && (
                <p className="homelab-hint">{data.storage.message}</p>
              )}
            </section>
          )}

          <section className="homelab-section" aria-labelledby="homelab-metrics-title">
            <div className="homelab-section__head">
              <h2 id="homelab-metrics-title" className="homelab-section__title">
                <Activity size={18} aria-hidden />
                Host metrics
              </h2>
              {grafanaUrl ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => openUrl(grafanaUrl)}>
                  Open Grafana
                  <ExternalLink size={14} aria-hidden />
                </button>
              ) : null}
            </div>
            {!data.metrics.available ? (
              <p className="homelab-hint">
                {data.metrics.message ?? "Start the monitoring stack: npm run monitoring:up"}
              </p>
            ) : (
              <>
                <div className="homelab-metrics">
                  <MetricCard icon={<Cpu size={20} />} label="CPU" value={data.metrics.cpuPercent} />
                  <MetricCard icon={<MemoryStick size={20} />} label="Memory" value={data.metrics.memoryPercent} />
                  <MetricCard icon={<HardDrive size={20} />} label="Disk (root)" value={data.metrics.diskPercent} />
                </div>
                {data.pihole?.connected ? (
                  <p className="homelab-hint homelab-metrics-note">{data.pihole.memoryNote}</p>
                ) : null}
              </>
            )}
          </section>

          {data.pihole && (
            <section className="homelab-section" aria-labelledby="homelab-pihole-title">
              <div className="homelab-section__head">
                <h2 id="homelab-pihole-title" className="homelab-section__title">
                  <Shield size={18} aria-hidden />
                  Pi-hole (DNS ad blocking)
                </h2>
                {data.pihole.adminUrl ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openUrl(data.pihole!.adminUrl)}>
                    Open admin
                    <ExternalLink size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="homelab-db-card">
                <div className="homelab-db-row">
                  <span>Status</span>
                  <span data-health={data.pihole.connected ? "ok" : "down"}>
                    {data.pihole.connected ? "Connected" : data.pihole.configured ? "Unreachable" : "Not configured"}
                  </span>
                </div>
                {data.pihole.queriesToday != null && (
                  <div className="homelab-db-row">
                    <span>Queries (recent)</span>
                    <span>{data.pihole.queriesToday.toLocaleString()}</span>
                  </div>
                )}
                {data.pihole.blockedToday != null && (
                  <div className="homelab-db-row">
                    <span>Blocked</span>
                    <span>
                      {data.pihole.blockedToday.toLocaleString()}
                      {data.pihole.percentBlocked != null ? ` (${data.pihole.percentBlocked}%)` : ""}
                    </span>
                  </div>
                )}
                {data.pihole.domainsBlocked != null && (
                  <div className="homelab-db-row">
                    <span>Block list</span>
                    <span>{data.pihole.domainsBlocked.toLocaleString()} domains</span>
                  </div>
                )}
                {data.pihole.activeClients != null && (
                  <div className="homelab-db-row">
                    <span>Active clients</span>
                    <span>{data.pihole.activeClients}</span>
                  </div>
                )}
                <div className="homelab-db-row">
                  <span>DNS via Tailscale</span>
                  <span>Nameserver {data.overview.host} (+ fallback)</span>
                </div>
                {data.pihole.message && !data.pihole.connected && (
                  <p className="homelab-hint">{data.pihole.message}</p>
                )}
              </div>
            </section>
          )}

          {data.icloud && (
            <section className="homelab-section" aria-labelledby="homelab-icloud-title">
              <div className="homelab-section__head">
                <h2 id="homelab-icloud-title" className="homelab-section__title">
                  <Cloud size={18} aria-hidden />
                  iCloud Photos import
                </h2>
                {data.icloud.immichUrl ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openUrl(data.icloud!.immichUrl)}>
                    Open Immich
                    <ExternalLink size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="homelab-db-card">
                <div className="homelab-db-row">
                  <span>Apple ID</span>
                  <span>{data.icloud.appleId || "—"}</span>
                </div>
                <div className="homelab-db-row">
                  <span>Login</span>
                  <span data-health={data.icloud.authenticated ? "ok" : "down"}>
                    {data.icloud.authenticated ? "Authenticated" : data.icloud.configured ? "Needs 2FA setup" : "Not configured"}
                  </span>
                </div>
                <div className="homelab-db-row">
                  <span>Import folder</span>
                  <span className="homelab-db-row__mono">{data.icloud.importPath}</span>
                </div>
                {data.icloud.importFileCount != null && (
                  <div className="homelab-db-row">
                    <span>Local photos</span>
                    <span>
                      {data.icloud.importFileCount > 0
                        ? `${data.icloud.importFileCount.toLocaleString()} files`
                        : "None yet"}
                    </span>
                  </div>
                )}
                {data.icloud.message && (
                  <p className="homelab-hint">{data.icloud.message}</p>
                )}
                {data.icloud.setupHint && !data.icloud.authenticated && (
                  <pre className="homelab-deploy-output homelab-icloud-setup">{data.icloud.setupHint}</pre>
                )}
              </div>
            </section>
          )}

          <section className="homelab-section" aria-labelledby="homelab-db-title">
            <h2 id="homelab-db-title" className="homelab-section__title">
              <Database size={18} aria-hidden />
              Cortex database
            </h2>
            <div className="homelab-db-card">
              <div className="homelab-db-row">
                <span>Status</span>
                <span data-health={data.database.connected ? "ok" : "down"}>
                  {data.database.connected ? "Connected" : "Unreachable"}
                </span>
              </div>
              <div className="homelab-db-row">
                <span>Provider</span>
                <span>{data.database.provider}</span>
              </div>
              <div className="homelab-db-row">
                <span>Host</span>
                <span>{data.database.host}</span>
              </div>
              <div className="homelab-db-row">
                <span>Database</span>
                <span>{data.database.database}</span>
              </div>
              <div className="homelab-db-row">
                <span>User</span>
                <span>{data.database.user}</span>
              </div>
              {data.database.taskCount != null && (
                <div className="homelab-db-row">
                  <span>Tasks</span>
                  <span>{data.database.taskCount}</span>
                </div>
              )}
              {data.database.mailAccountCount != null && (
                <div className="homelab-db-row">
                  <span>Mail accounts</span>
                  <span>{data.database.mailAccountCount}</span>
                </div>
              )}
              {data.database.message && !data.database.connected && (
                <p className="homelab-hint">{data.database.message}</p>
              )}
            </div>
          </section>

          {data.cloud && (
            <section className="homelab-section" aria-labelledby="homelab-cloud-title">
              <div className="homelab-section__head">
                <h2 id="homelab-cloud-title" className="homelab-section__title">
                  <Cloud size={18} aria-hidden />
                  Cloud storage
                </h2>
                {data.cloud.baseUrl && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openUrl(data.cloud!.baseUrl)}>
                    Open Nextcloud
                    <ExternalLink size={14} aria-hidden />
                  </button>
                )}
              </div>
              <div className="homelab-db-card">
                <div className="homelab-db-row">
                  <span>Status</span>
                  <span data-health={data.cloud.connected ? "ok" : "down"}>
                    {data.cloud.connected ? "Connected" : "Unavailable"}
                  </span>
                </div>
                <div className="homelab-db-row">
                  <span>User</span>
                  <span>{data.cloud.username || "—"}</span>
                </div>
                {data.cloud.quota && (
                  <div className="homelab-db-row">
                    <span>Quota</span>
                    <span>
                      {data.cloud.quota.usedHuman} / {data.cloud.quota.totalHuman}
                      {data.cloud.quota.usedPercent != null ? ` (${data.cloud.quota.usedPercent}%)` : ""}
                    </span>
                  </div>
                )}
                {data.cloud.message && !data.cloud.connected && (
                  <p className="homelab-hint">{data.cloud.message}</p>
                )}
              </div>
            </section>
          )}

          <section className="homelab-section" aria-labelledby="homelab-services-title">
            <h2 id="homelab-services-title" className="homelab-section__title">
              <Server size={18} aria-hidden />
              Services
            </h2>
            <div className="homelab-services">
              {data.services.map((svc) => (
                <article key={svc.id} className="homelab-service" data-health={svc.health}>
                  <div className="homelab-service__top">
                    <span className="homelab-service__dot" data-health={svc.health} aria-hidden />
                    <div>
                      <h3 className="homelab-service__name">{svc.name}</h3>
                      <p className="homelab-service__desc">{svc.description}</p>
                    </div>
                  </div>
                  <div className="homelab-service__meta">
                    <span>{healthLabel(svc.health)}</span>
                    {svc.latencyMs != null && <span>{svc.latencyMs}ms</span>}
                    {svc.message && svc.health !== "ok" && (
                      <span className="homelab-service__msg">{svc.message}</span>
                    )}
                  </div>
                  {svc.openUrl ? (
                    <button type="button" className="btn-ghost btn-sm homelab-service__open" onClick={() => openUrl(svc.openUrl)}>
                      Open
                      <ExternalLink size={14} aria-hidden />
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
