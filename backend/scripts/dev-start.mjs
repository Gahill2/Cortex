/**
 * Backend dev entry: optional Prisma migrate, then tsx watch.
 * Set CORTEX_SKIP_PRISMA_DEPLOY=1 to skip migrate (saves ~200MB spike on each restart).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runPrismaDeploy() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(backendRoot, "scripts", "prisma-deploy.mjs")], {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`prisma-deploy exit ${code}`))));
  });
}

async function main() {
  if (process.env.CORTEX_SKIP_PRISMA_DEPLOY !== "1") {
    await runPrismaDeploy();
  }

  const child = spawn("npx", ["tsx", "watch", "src/server.ts"], {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });

  child.on("close", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error("[dev-start]", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("[dev-start]", err);
  process.exit(1);
});
