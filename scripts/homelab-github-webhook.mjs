#!/usr/bin/env node
/**
 * GitHub push webhook → homelab-deploy.sh
 * Listen on CORTEX_WEBHOOK_PORT (default 9090). Set GITHUB_WEBHOOK_SECRET in deploy/homelab/.env.
 *
 * GitHub → Settings → Webhooks → Payload URL:
 *   http://100.x.x.x:9090/hooks/cortex-deploy  (or Tailscale MagicDNS)
 * Events: push
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COMPOSE_ENV = join(ROOT, "deploy/homelab/.env");

function loadSecret() {
  if (process.env.GITHUB_WEBHOOK_SECRET) return process.env.GITHUB_WEBHOOK_SECRET;
  if (!existsSync(COMPOSE_ENV)) return "";
  for (const line of readFileSync(COMPOSE_ENV, "utf8").split("\n")) {
    const m = line.match(/^\s*GITHUB_WEBHOOK_SECRET\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const SECRET = loadSecret();
const PORT = Number(process.env.CORTEX_WEBHOOK_PORT || 9090);
const BRANCH = process.env.CORTEX_DEPLOY_BRANCH || "main";
const HOOK_PATH = "/hooks/cortex-deploy";

let deploying = false;

function verifySignature(body, sigHeader) {
  if (!SECRET) return true; // dev only — set GITHUB_WEBHOOK_SECRET in production
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", SECRET).update(body).digest("hex");
  const actual = sigHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

function runDeploy() {
  if (deploying) return Promise.resolve({ skipped: true });
  deploying = true;
  return new Promise((resolve) => {
    const child = spawn(join(ROOT, "scripts/homelab-deploy.sh"), [], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      deploying = false;
      resolve({ code });
    });
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, deploying }));
    return;
  }

  if (req.method !== "POST" || req.url !== HOOK_PATH) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  if (!verifySignature(body, req.headers["x-hub-signature-256"])) {
    res.writeHead(401);
    res.end("Invalid signature");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    res.writeHead(400);
    res.end("Bad JSON");
    return;
  }

  const ref = payload.ref || "";
  const expectedRef = `refs/heads/${BRANCH}`;
  if (payload.deleted || ref !== expectedRef) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, skipped: true, reason: "ref mismatch" }));
    return;
  }

  console.log(`[webhook] push to ${BRANCH} by ${payload.pusher?.email || "unknown"}`);
  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, accepted: true }));

  void runDeploy();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[webhook] listening on :${PORT}${HOOK_PATH}`);
  if (!SECRET) console.warn("[webhook] GITHUB_WEBHOOK_SECRET unset — signatures not verified");
});
