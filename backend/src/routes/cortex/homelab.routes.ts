import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  checkHomelabServices,
  getCloudStorageStatus,
  getDatabaseStatus,
  getHomelabMetrics,
  getHomelabOverview
} from "../../features/homelab/homelab-status.js";
import { getHostStorageStatus } from "../../features/homelab/host-storage.js";
import {
  getHomelabDeployListenerHealth,
  runHomelabDeploy,
  runHomelabDockerDoctor,
} from "../../features/homelab/homelab-deploy.js";
import { listHomelabServices } from "../../features/homelab/homelab-services.js";
import { getIcloudStatus } from "../../features/homelab/icloud-service.js";
import { getPiholeStatus } from "../../features/homelab/pihole-service.js";
import {
  listHomelabContainers,
  restartHomelabContainer,
} from "../../features/homelab/homelab-containers.js";
import { getHomelabIntegrationsSummary } from "../../features/homelab/homelab-integrations.js";
import { homelabSafe } from "../../features/homelab/homelab-safe.js";
import type { HomelabCloudStorage, HomelabDatabaseStatus, HomelabMetrics, HomelabServiceStatus } from "../../features/homelab/homelab-status.js";
import type { HostStorageStatus } from "../../features/homelab/host-storage.js";
import type { HomelabPiholeStatus } from "../../features/homelab/pihole-service.js";
import type { HomelabIcloudStatus } from "../../features/homelab/icloud-service.js";
import type { HomelabIntegrationsSummary } from "../../features/homelab/homelab-integrations.js";
import { HttpError } from "../../utils/http-error.js";

export const cortexHomelabRouter = Router();

cortexHomelabRouter.use(requireAuth);

const emptyMetrics: HomelabMetrics = {
  available: false,
  cpuPercent: null,
  memoryPercent: null,
  diskPercent: null,
  message: "Metrics unavailable",
};

const emptyDatabase: HomelabDatabaseStatus = {
  connected: false,
  provider: "postgresql",
  host: "unknown",
  database: "cortex",
  user: "cortex",
  taskCount: null,
  mailAccountCount: null,
  message: "Database status unavailable",
};

const emptyStorage: HostStorageStatus = {
  available: false,
  systemDisk: null,
  nasRoot: null,
  nasTotalBytes: null,
  nasTotalHuman: null,
  nasFolders: [],
  downloadHeadroomHuman: null,
  message: "Storage status unavailable",
};

const emptyIntegrations: HomelabIntegrationsSummary = {
  cloud: {
    configured: false,
    connected: false,
    baseUrl: "",
    username: "",
    quota: null,
    message: "Unavailable",
  },
  mail: {
    gmailConfigured: false,
    connected: false,
    accountCount: 0,
    message: "Unavailable",
  },
};

/** Lightweight snapshot for home canvas widgets (no Pi-hole, iCloud, du scans, or mail/cloud). */
cortexHomelabRouter.get("/quick", routeRateLimit(60, 60_000), async (_req, res) => {
  const [services, metrics, storage] = await Promise.all([
    homelabSafe("services", () => checkHomelabServices(), [] as HomelabServiceStatus[]),
    homelabSafe("metrics", () => getHomelabMetrics(), emptyMetrics),
    homelabSafe("storage", () => getHostStorageStatus({ light: true }), emptyStorage),
  ]);
  sendSuccess(res, { services, metrics, storage }, "live");
});

/** Full homelab dashboard payload — services, metrics, database. */
cortexHomelabRouter.get("/status", routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const [services, metrics, database, storage, pihole, icloud, integrations, containers] =
    await Promise.all([
      homelabSafe("services", () => checkHomelabServices(), [] as HomelabServiceStatus[]),
      homelabSafe("metrics", () => getHomelabMetrics(), emptyMetrics),
      homelabSafe("database", () => getDatabaseStatus(), emptyDatabase),
      homelabSafe("storage", () => getHostStorageStatus(), emptyStorage),
      homelabSafe("pihole", () => getPiholeStatus(), {
        configured: false,
        connected: false,
        baseUrl: "",
        adminUrl: "",
        queriesToday: null,
        blockedToday: null,
        percentBlocked: null,
        domainsBlocked: null,
        activeClients: null,
        memoryNote: "",
        message: "Pi-hole status unavailable",
      } satisfies HomelabPiholeStatus),
      homelabSafe("icloud", async () => getIcloudStatus(), {
        configured: false,
        authenticated: false,
        appleId: "",
        importPath: "",
        importSizeHuman: null,
        importFileCount: null,
        immichUrl: "",
        message: "iCloud status unavailable",
      } satisfies HomelabIcloudStatus),
      homelabSafe("integrations", () => getHomelabIntegrationsSummary(userId), emptyIntegrations),
      homelabSafe("containers", () => listHomelabContainers(), {
        available: false,
        containers: [],
        message: "Container list unavailable",
      }),
    ]);
  sendSuccess(
    res,
    {
      overview: getHomelabOverview(),
      services,
      metrics,
      database,
      cloud: integrations.cloud,
      mail: integrations.mail,
      storage,
      pihole,
      icloud,
      containers,
    },
    "live"
  );
});

/** Service registry (no HTTP probes — fast). */
cortexHomelabRouter.get("/services", routeRateLimit(60, 60_000), (_req, res) => {
  sendSuccess(res, { services: listHomelabServices() }, "live");
});

/** Postgres health + row counts. */
cortexHomelabRouter.get("/database", routeRateLimit(30, 60_000), async (_req, res) => {
  sendSuccess(res, await getDatabaseStatus(), "live");
});

/** Prometheus host metrics snapshot. */
cortexHomelabRouter.get("/metrics", routeRateLimit(20, 60_000), async (_req, res) => {
  sendSuccess(res, await getHomelabMetrics(), "live");
});

/** Disk + NAS folder usage (no Prometheus required). */
cortexHomelabRouter.get("/storage", routeRateLimit(20, 60_000), async (_req, res) => {
  sendSuccess(res, await getHostStorageStatus(), "live");
});

/** Host deploy listener health (for Homelab UI). */
cortexHomelabRouter.get("/deploy/status", routeRateLimit(30, 60_000), async (_req, res) => {
  sendSuccess(res, await getHomelabDeployListenerHealth(), "live");
});

/** Rebuild and restart cortex-api + cortex-web on the host (via deploy listener). */
cortexHomelabRouter.post("/deploy", routeRateLimit(3, 300_000), async (_req, res) => {
  const result = await runHomelabDeploy();
  if (!result.ok && !result.needsFix) {
    throw new HttpError(502, result.output.slice(0, 500));
  }
  sendSuccess(res, result, "live");
});

/** Check Docker permissions on the host. */
cortexHomelabRouter.post("/deploy/doctor", routeRateLimit(10, 60_000), async (_req, res) => {
  sendSuccess(res, await runHomelabDockerDoctor(), "live");
});

/** Docker containers on this host (via deploy listener). */
cortexHomelabRouter.get("/containers", routeRateLimit(30, 60_000), async (_req, res) => {
  sendSuccess(res, await listHomelabContainers(), "live");
});

/** Restart one container by name. */
cortexHomelabRouter.post(
  "/containers/:id/restart",
  routeRateLimit(15, 60_000),
  async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    if (!id) throw new HttpError(400, "Container id required");
    const result = await restartHomelabContainer(id);
    if (!result.ok) {
      throw new HttpError(result.listenerAvailable ? 502 : 503, result.error ?? "Restart failed");
    }
    sendSuccess(res, result, "live");
  },
);
