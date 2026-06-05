import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const listenHost = process.env.HOST?.trim() || "0.0.0.0";
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// NOTE: Migrations run asynchronously after the HTTP server starts listening.
// This is intentional for Railway/container deployments where the platform
// health-checks the port before the process is considered live. Running
// migrations synchronously before listen() would delay readiness and risk
// health-check timeouts on slow migration runs.
//
// Trade-off: a request that arrives in the brief window between listen() and
// migration completion could see a stale schema. This is acceptable here
// because: (a) Railway routes traffic only after the health-check passes, and
// (b) the migration script is idempotent. If synchronous pre-listen migrations
// are ever required, replace the spawn+callback pattern below with an awaited
// execSync or a promisified child_process.exec call before the app.listen() call.
function runMigrationsAfterListen(): void {
  if (env.NODE_ENV !== "production") return;

  const script = join(backendRoot, "scripts/prisma-deploy.mjs");
  if (!existsSync(script)) {
    logger.warn("prisma-deploy script missing — skipping migrate");
    return;
  }

  logger.info("Running database migrations in background");
  const child = spawn(process.execPath, [script], {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env
  });

  child.on("close", (code) => {
    if (code === 0) {
      logger.info("Database migrations finished");
      return;
    }
    logger.error("Database migrations failed", { exitCode: code });
  });
}

app.listen(env.PORT, listenHost, () => {
  logger.info("Cortex API listening", {
    host: listenHost,
    port: env.PORT,
    nodeEnv: env.NODE_ENV
  });
  runMigrationsAfterListen();
});
