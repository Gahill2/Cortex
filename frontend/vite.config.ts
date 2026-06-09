import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveBuildMeta() {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "package.json"), "utf8"),
  ) as { version?: string };

  let sha = process.env.VITE_BUILD_SHA || process.env.CORTEX_BUILD_SHA || "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
        cwd: resolve(__dirname, ".."),
      }).trim();
    } catch {
      sha = "dev";
    }
  }

  let sw = "unknown";
  try {
    const swSrc = readFileSync(resolve(__dirname, "public/sw.js"), "utf8");
    sw = swSrc.match(/CACHE_NAME = "([^"]+)"/)?.[1] ?? "unknown";
  } catch {
    /* ignore */
  }

  return {
    VITE_APP_VERSION: pkg.version ?? "1.0.0",
    VITE_BUILD_SHA: sha,
    VITE_BUILD_TIME: process.env.VITE_BUILD_TIME || new Date().toISOString(),
    VITE_SW_VERSION: sw,
  };
}

const buildMeta = resolveBuildMeta();
for (const [key, value] of Object.entries(buildMeta)) {
  process.env[key] = value;
}

export default defineConfig(({ mode }) => {
  const lite = mode === "lite" || process.env.CORTEX_VITE_LITE === "1";

  return {
    plugins: [react()],
    optimizeDeps: {
      // simple-icons is large; skip pre-bundle in lite dev to reduce RAM (icons load on demand).
      include: lite ? [] : ["simple-icons"],
    },
    resolve: {
      // Prefer TS/TSX sources when duplicate JS artifacts exist in src/.
      extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 5173,
      strictPort: true,
      // Never use Vite's browser open — Cursor Simple Browser can crash on heavy pages; use Chrome.
      open: false,
      // Allow http://<Tailscale-IP>:5173 from other devices on your tailnet
      host: true,
      proxy: {
        // Browser dev uses same-origin `/api` (see `api/client.ts`); Electron still hits localhost:4000 directly.
        // Set CORTEX_API_PROXY_TARGET to point dev at a remote hub (e.g. http://cortex:4000 on the tailnet).
        "/api": {
          target: process.env.CORTEX_API_PROXY_TARGET || "http://127.0.0.1:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
