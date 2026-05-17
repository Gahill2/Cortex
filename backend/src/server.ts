import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const listenHost = process.env.HOST?.trim() || "0.0.0.0";
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

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
