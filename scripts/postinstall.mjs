/**
 * Root postinstall — skip heavy electron native deps when doing web-only work.
 * CORTEX_SKIP_ELECTRON_POSTINSTALL=1 npm install
 */
import { spawn } from "node:child_process";

if (process.env.CORTEX_SKIP_ELECTRON_POSTINSTALL === "1") {
  console.log("[cortex] Skipping electron-builder install-app-deps (CORTEX_SKIP_ELECTRON_POSTINSTALL=1)");
  process.exit(0);
}

const child = spawn("npx", ["electron-builder", "install-app-deps"], {
  stdio: "inherit",
  shell: true,
});

child.on("close", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[postinstall]", err);
  process.exit(1);
});
