/**
 * Waits for backend health + a Vite dev server on 5173–5190, then compiles
 * Electron and launches it with CORTEX_VITE_URL set (avoids stale 5173 when
 * Vite picks another port).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1200 }, (res) => {
      const ok = res.statusCode != null && res.statusCode >= 200 && res.statusCode < 400;
      res.resume();
      resolve(ok);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** True if this looks like Vite serving the Cortex SPA (not some other HTTP on 5173). */
function looksLikeViteIndex(html) {
  return (
    typeof html === "string" &&
    (html.includes("@vite/client") || html.includes("/src/main") || html.includes("/@react-refresh"))
  );
}

function getIndexSnippet(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 1500 }, (res) => {
      if (res.statusCode == null || res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        resolve("");
        return;
      }
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buf += chunk;
        if (buf.length >= 12_000) {
          res.destroy();
          resolve(buf);
        }
      });
      res.on("end", () => resolve(buf));
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => {
      req.destroy();
      resolve("");
    });
  });
}

async function waitFor(fn, label, timeoutMs = 300_000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeoutMs) {
      console.error(`[electron] Timed out waiting for ${label}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function main() {
  await waitFor(() => httpOk("http://localhost:4000/api/health"), "backend /api/health");

  let viteUrl;
  await waitFor(async () => {
    for (let p = 5173; p <= 5190; p++) {
      if (!(await httpOk(`http://localhost:${p}/`))) continue;
      const snippet = await getIndexSnippet(p);
      if (looksLikeViteIndex(snippet)) {
        viteUrl = `http://localhost:${p}`;
        return true;
      }
    }
    return false;
  }, "Vite dev server (5173–5190, /@vite/client)");

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
  console.error(e);
  process.exit(1);
});
