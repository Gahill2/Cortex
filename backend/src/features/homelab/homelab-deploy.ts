import { existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "../../config/env.js";

export type HomelabDeployResult = {
  ok: boolean;
  needsFix: boolean;
  output: string;
  fixCommand: string;
  listenerAvailable: boolean;
};

const FIX_COMMAND = "npm run server:docker:fix-once";

function listenerUrl(path: string): string {
  const base = env.HOMELAB_DEPLOY_LISTENER_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

async function callListener(path: "/deploy" | "/doctor"): Promise<HomelabDeployResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.HOMELAB_DEPLOY_TOKEN) {
    headers.Authorization = `Bearer ${env.HOMELAB_DEPLOY_TOKEN}`;
  }

  try {
    const res = await fetch(listenerUrl(path), {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(600_000),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      needsFix?: boolean;
      output?: string;
      error?: string;
    };
    const output = body.output?.trim() || body.error || `HTTP ${res.status}`;
    return {
      ok: Boolean(body.ok),
      needsFix: Boolean(body.needsFix),
      output,
      fixCommand: FIX_COMMAND,
      listenerAvailable: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      needsFix: false,
      output: `Deploy listener unreachable (${msg}). On the cortex PC run: npm run server:deploy:setup`,
      fixCommand: FIX_COMMAND,
      listenerAvailable: false,
    };
  }
}

/** True when API runs on the host (dev), not inside Docker. */
function isHostDev(): boolean {
  return existsSync("/.dockerenv") === false && env.NODE_ENV === "development";
}

function repoRoot(): string {
  if (env.HOMELAB_REPO_ROOT.trim()) return env.HOMELAB_REPO_ROOT.trim();
  if (existsSync(join(process.cwd(), "scripts/homelab-deploy.sh"))) return process.cwd();
  if (existsSync(join(process.cwd(), "..", "scripts/homelab-deploy.sh"))) return join(process.cwd(), "..");
  return process.cwd();
}

async function spawnOnHost(script: string): Promise<HomelabDeployResult> {
  const root = repoRoot();
  const scriptPath = join(root, "scripts", script);
  if (!existsSync(scriptPath)) {
    return {
      ok: false,
      needsFix: false,
      output: `Script not found: ${scriptPath}`,
      fixCommand: FIX_COMMAND,
      listenerAvailable: false,
    };
  }

  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("bash", [scriptPath], { cwd: root, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("close", (code) => {
      const output = (stdout + stderr).trim();
      resolve({
        ok: code === 0,
        needsFix: /fix-once|Cannot stop|permission denied/i.test(output),
        output: output.slice(-4000) || `Exit ${code}`,
        fixCommand: FIX_COMMAND,
        listenerAvailable: true,
      });
    });
  });
}

export async function runHomelabDeploy(): Promise<HomelabDeployResult> {
  if (isHostDev()) {
    return spawnOnHost("homelab-deploy.sh");
  }
  return callListener("/deploy");
}

export async function runHomelabDockerDoctor(): Promise<HomelabDeployResult> {
  if (isHostDev()) {
    return spawnOnHost("homelab-docker-doctor.sh");
  }
  return callListener("/doctor");
}

export async function getHomelabDeployListenerHealth(): Promise<{ available: boolean; tokenConfigured?: boolean }> {
  try {
    const res = await fetch(listenerUrl("/health"), { signal: AbortSignal.timeout(3_000) });
    if (!res.ok) return { available: false };
    const body = (await res.json()) as { ok?: boolean; tokenConfigured?: boolean };
    return { available: Boolean(body.ok), tokenConfigured: body.tokenConfigured };
  } catch {
    return { available: false };
  }
}
