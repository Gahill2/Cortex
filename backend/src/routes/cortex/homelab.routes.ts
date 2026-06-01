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
import { HttpError } from "../../utils/http-error.js";

export const cortexHomelabRouter = Router();

cortexHomelabRouter.use(requireAuth);

/** Full homelab dashboard payload — services, metrics, database. */
cortexHomelabRouter.get("/status", routeRateLimit(30, 60_000), async (_req, res) => {
  const [services, metrics, database, cloud, storage, pihole, icloud] = await Promise.all([
    checkHomelabServices(),
    getHomelabMetrics(),
    getDatabaseStatus(),
    getCloudStorageStatus(),
    getHostStorageStatus(),
    getPiholeStatus(),
    Promise.resolve(getIcloudStatus())
  ]);
  sendSuccess(
    res,
    {
      overview: getHomelabOverview(),
      services,
      metrics,
      database,
      cloud,
      storage,
      pihole,
      icloud
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
