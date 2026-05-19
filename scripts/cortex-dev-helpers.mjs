/**
 * Shared probes for Cortex dev servers (backend health + Vite on 5173–5190).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";

export function httpOk(url) {
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

function looksLikeViteIndex(html) {
  return (
    typeof html === "string" &&
    (html.includes("@vite/client") || html.includes("/src/main.tsx") || html.includes("/@react-refresh"))
  );
}

function looksLikeCortexIndex(html) {
  return (
    looksLikeViteIndex(html) &&
    (html.includes("<title>Cortex</title>") ||
      html.includes('apple-mobile-web-app-title" content="Cortex"') ||
      html.includes("Plus+Jakarta+Sans"))
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

/** Resolve the Cortex Vite dev URL (highest port in 5173–5190 that serves our index). */
export async function findCortexViteUrl() {
  let bestPort = 0;
  for (let p = 5173; p <= 5190; p++) {
    if (!(await httpOk(`http://localhost:${p}/`))) continue;
    const snippet = await getIndexSnippet(p);
    if (looksLikeCortexIndex(snippet) && p > bestPort) bestPort = p;
  }
  return bestPort > 0 ? `http://localhost:${bestPort}` : null;
}

export async function waitFor(fn, label, timeoutMs = 300_000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

function resolveChromeExecutable() {
  const fromEnv = process.env.CORTEX_CHROME_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [];
  if (process.platform === "win32") {
    const pf = process.env.ProgramFiles;
    const pfx86 = process.env["ProgramFiles(x86)"];
    const local = process.env.LOCALAPPDATA;
    if (pf) candidates.push(`${pf}\\Google\\Chrome\\Application\\chrome.exe`);
    if (pfx86) candidates.push(`${pfx86}\\Google\\Chrome\\Application\\chrome.exe`);
    if (local) candidates.push(`${local}\\Google\\Chrome\\Application\\chrome.exe`);
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  } else {
    candidates.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser");
  }
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

/**
 * Open Cortex in Google Chrome only (never the OS default browser).
 * Set CORTEX_OPEN_BROWSER=0 to skip. Set CORTEX_CHROME_PATH if Chrome is non-standard.
 */
export function openBrowser(url) {
  openCortexInChrome(url);
}

export function openCortexInChrome(url) {
  if (process.env.CORTEX_OPEN_BROWSER === "0") return;

  const chrome = resolveChromeExecutable();
  if (!chrome) {
    console.warn(
      "[cortex] Google Chrome not found — install Chrome or set CORTEX_CHROME_PATH to chrome.exe"
    );
    console.warn(`[cortex] Open manually: ${url}`);
    return;
  }

  spawnDetached(chrome, [url]);
}

function spawnDetached(cmd, args) {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore", shell: false });
  child.unref();
}
