/**
 * Waits for backend health + a Vite dev server on 5173–5190, then compiles
 * Electron and launches it with CORTEX_VITE_URL set (avoids stale 5173 when
 * Vite picks another port).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCortexViteUrl, httpOk, waitFor } from "./cortex-dev-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  await waitFor(() => httpOk("http://127.0.0.1:4000/api/health"), "backend /api/health");

  let viteUrl;
  await waitFor(async () => {
    viteUrl = await findCortexViteUrl();
    return Boolean(viteUrl);
  }, "Vite dev server (5173–5190, Cortex index)");

  console.log("[electron] CORTEX_VITE_URL =", viteUrl);

  const env = { ...process.env, CORTEX_VITE_URL: viteUrl };

  const tscCode = await new Promise((resolve, reject) => {
    const tsc = spawn("npx", ["tsc", "-p", "electron/tsconfig.json"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env,
    });
    tsc.on("error", reject);
    tsc.on("close", (code) => resolve(code ?? 1));
  });
  if (tscCode !== 0) process.exit(tscCode);

  const el = spawn("npx", ["electron", "."], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env,
  });
  el.on("close", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error("[electron]", e instanceof Error ? e.message : e);
  process.exit(1);
});
