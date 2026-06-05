import { env } from "../../config/env.js";

export type HomelabContainerHealth = "ok" | "warn" | "down" | "unknown";

export interface HomelabContainerRow {
  id: string;
  name: string;
  status: string;
  state: string;
  health: HomelabContainerHealth;
  canRestart: boolean;
}

export interface HomelabContainerActionResult {
  ok: boolean;
  id?: string;
  output?: string;
  error?: string;
  listenerAvailable: boolean;
}

function listenerUrl(path: string): string {
  return `${env.HOMELAB_DEPLOY_LISTENER_URL.replace(/\/$/, "")}${path}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.HOMELAB_DEPLOY_TOKEN) {
    headers.Authorization = `Bearer ${env.HOMELAB_DEPLOY_TOKEN}`;
  }
  return headers;
}

export async function listHomelabContainers(): Promise<{
  available: boolean;
  containers: HomelabContainerRow[];
  message?: string;
}> {
  try {
    const res = await fetch(listenerUrl("/containers"), {
      headers: authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        available: false,
        containers: [],
        message: `Listener HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as { containers?: HomelabContainerRow[] };
    return {
      available: true,
      containers: json.containers ?? [],
    };
  } catch (e) {
    return {
      available: false,
      containers: [],
      message: e instanceof Error ? e.message : "Deploy listener unreachable",
    };
  }
}

async function postContainerAction(
  id: string,
  action: "start" | "stop" | "restart",
): Promise<HomelabContainerActionResult> {
  const encoded = encodeURIComponent(id);
  try {
    const res = await fetch(listenerUrl(`/containers/${encoded}/${action}`), {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json()) as { ok?: boolean; output?: string; error?: string; id?: string };
    return {
      ok: Boolean(json.ok),
      id: json.id ?? id,
      output: json.output,
      error: json.error,
      listenerAvailable: true,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : `${action} failed`,
      listenerAvailable: false,
    };
  }
}

export async function startHomelabContainer(id: string): Promise<HomelabContainerActionResult> {
  return postContainerAction(id, "start");
}

export async function stopHomelabContainer(id: string): Promise<HomelabContainerActionResult> {
  return postContainerAction(id, "stop");
}

export async function restartHomelabContainer(id: string): Promise<HomelabContainerActionResult> {
  return postContainerAction(id, "restart");
}
