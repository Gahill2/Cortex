/**
 * Start backend + frontend without `concurrently` (one less Node parent).
 * Lite mode is on unless CORTEX_DEV_FULL=1 (see docs/dev-resources.md).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lite = process.env.CORTEX_DEV_FULL !== "1";

const env = { ...process.env };
if (lite) {
  env.CORTEX_SKIP_PRISMA_DEPLOY = "1";
  env.CORTEX_VITE_LITE = "1";
}

const children = [];

function run(cwd, script) {
  const child = spawn("npm", ["run", script], {
    cwd,
    stdio: "inherit",
    shell: true,
    env,
  });
  children.push(child);
  return child;
}

const backendScript = lite ? "dev:lite" : "dev";
const frontendScript = lite ? "dev:lite" : "dev";

run(path.join(root, "backend"), backendScript);
run(path.join(root, "frontend"), frontendScript);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (lite) {
  console.log("[cortex] Lite dev (less RAM). Full stack: CORTEX_DEV_FULL=1 npm run dev");
}
