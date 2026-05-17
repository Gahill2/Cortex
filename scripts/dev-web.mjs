/**
 * One command: API + Vite dev server, then print URLs and open the app in your browser.
 * Set CORTEX_OPEN_BROWSER=0 to skip auto-open.
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
    console.log("  Desktop: npm run dev:desktop  (Electron shell)");
    console.log("");

    openBrowser(appUrl);
  } catch (err) {
    console.error("[dev]", err instanceof Error ? err.message : err);
  }
}

function main() {
  const child = spawn("npm", ["run", "dev:servers"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
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
