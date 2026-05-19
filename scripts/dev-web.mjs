/**
 * One command: API + Vite dev server, then print URLs and open Chrome (if installed).
 *
 * Default is **lite dev** (less RAM). Set CORTEX_DEV_FULL=1 for Prisma on every restart.
 * See docs/dev-resources.md. Chrome only; CORTEX_OPEN_BROWSER=0 to skip.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCortexViteUrl, httpOk, openBrowser, waitFor } from "./cortex-dev-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let opened = false;

async function announceWhenReady() {
  try {
    await waitFor(() => httpOk("http://127.0.0.1:4000/api/health"), "backend /api/health");
    let appUrl;
    await waitFor(async () => {
      appUrl = await findCortexViteUrl();
      return Boolean(appUrl);
    }, "Vite dev server (5173–5190, Cortex index)");

    if (opened) return;
    opened = true;

    console.log("");
    console.log("  Cortex dev ready");
    console.log("  ─────────────────────────────────────");
    console.log(`  App:     ${appUrl}`);
    console.log("  API:     http://127.0.0.1:4000/api/health");
    console.log("  Stop:    Ctrl+C");
    console.log("  Lite dev:  default (docs/dev-resources.md)");
    console.log("  Full dev:  CORTEX_DEV_FULL=1 npm run dev");
    console.log("");

    openBrowser(appUrl);
  } catch (err) {
    console.error("[dev]", err instanceof Error ? err.message : err);
  }
}

function main() {
  if (process.env.CORTEX_DEV_FULL !== "1") {
    process.env.CORTEX_SKIP_PRISMA_DEPLOY = "1";
    process.env.CORTEX_VITE_LITE = "1";
  }

  console.warn(
    "[dev] Vite uses port 5173 with strictPort. If npm run dev fails, stop other Vite/node on 5173 (Task Manager or: Get-NetTCPConnection -LocalPort 5173).",
  );

  const child = spawn(process.execPath, ["scripts/dev-servers.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  void announceWhenReady();

  const shutdown = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error("[dev]", err);
    process.exit(1);
  });
}

main();
