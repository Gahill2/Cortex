import { cfg } from "./config.js";

export interface ContainerRow {
  id: string;
  name: string;
  status: string;
  state: string;
  health: string;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (cfg.deployToken) h.Authorization = `Bearer ${cfg.deployToken}`;
  return h;
}

export async function listContainers(): Promise<{ ok: boolean; containers: ContainerRow[]; error?: string }> {
  try {
    const res = await fetch(`${cfg.listenerUrl}/containers`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, containers: [], error: `Listener HTTP ${res.status}` };
    }
    const json = (await res.json()) as { containers?: ContainerRow[] };
    return { ok: true, containers: json.containers ?? [] };
  } catch (e) {
    return {
      ok: false,
      containers: [],
      error: e instanceof Error ? e.message : "Listener unreachable",
    };
  }
}

export async function containerAction(
  id: string,
  action: "start" | "stop" | "restart",
): Promise<{ ok: boolean; error?: string; output?: string }> {
  try {
    const res = await fetch(`${cfg.listenerUrl}/containers/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; output?: string };
    return { ok: Boolean(json.ok), error: json.error, output: json.output };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : `${action} failed` };
  }
}
