#!/usr/bin/env node
/**
 * Host-side deploy listener — lets Cortex API (in Docker) trigger homelab deploy without sudo.
 * Binds on the Docker bridge (0.0.0.0) so cortex-api can reach host.docker.internal:9092.
 * Token required when not on 127.0.0.1 only.
 *
 * Auth: Authorization: Bearer <CORTEX_DEPLOY_TOKEN> or X-Cortex-Deploy-Token header.
 * Token: deploy/homelab/.env CORTEX_DEPLOY_TOKEN (or env var).
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COMPOSE_ENV = join(ROOT, "deploy/homelab/.env");
const PORT = Number(process.env.CORTEX_DEPLOY_LISTENER_PORT || 9092);
const HOST = process.env.CORTEX_DEPLOY_LISTENER_HOST || "0.0.0.0";

function loadToken() {
  if (process.env.CORTEX_DEPLOY_TOKEN?.trim()) return process.env.CORTEX_DEPLOY_TOKEN.trim();
  if (!existsSync(COMPOSE_ENV)) return "";
  for (const line of readFileSync(COMPOSE_ENV, "utf8").split("\n")) {
    const m = line.match(/^\s*CORTEX_DEPLOY_TOKEN\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const TOKEN = loadToken();
let busy = false;

if (!TOKEN && HOST !== "127.0.0.1") {
  console.error(
    "[homelab-deploy-listener] CORTEX_DEPLOY_TOKEN required when listening on",
    HOST,
    "(set in deploy/homelab/.env or run npm run server:deploy:setup)",
  );
  process.exit(1);
}

function authOk(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const header = String(req.headers["x-cortex-deploy-token"] || "");
  const got = bearer || header;
  if (!got || got.length !== TOKEN.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN));
  } catch {
    return false;
  }
}

function runScript(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(script, args, { cwd: ROOT, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

const server = createServer(async (req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    json(200, { ok: true, busy, tokenConfigured: Boolean(TOKEN) });
    return;
  }

  if (!authOk(req)) {
    json(401, { ok: false, error: "Unauthorized" });
    return;
  }

  if (busy) {
    json(409, { ok: false, error: "Deploy already in progress" });
    return;
  }

  if (req.method === "POST" && req.url === "/doctor") {
    busy = true;
    try {
      const r = await runScript(join(ROOT, "scripts/homelab-docker-doctor.sh"));
      const out = (r.stdout + r.stderr).trim();
      const needsFix = r.code !== 0 && /fix-once|Cannot stop/i.test(out);
      json(200, { ok: r.code === 0, needsFix, output: out, exitCode: r.code });
    } finally {
      busy = false;
    }
    return;
  }

  if (req.method === "POST" && req.url === "/deploy") {
    busy = true;
    try {
      const r = await runScript(join(ROOT, "scripts/homelab-deploy.sh"));
      const out = (r.stdout + r.stderr).trim();
      const needsFix = /fix-once|Cannot stop|permission denied/i.test(out);
      json(r.code === 0 ? 200 : 502, {
        ok: r.code === 0,
        needsFix,
        output: out.slice(-4000),
        exitCode: r.code,
      });
    } finally {
      busy = false;
    }
    return;
  }

  json(404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[homelab-deploy-listener] http://${HOST}:${PORT} (token ${TOKEN ? "on" : "off — set CORTEX_DEPLOY_TOKEN"})`);
});
