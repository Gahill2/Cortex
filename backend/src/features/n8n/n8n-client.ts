import { env } from "../../config/env.js";

export type N8nTriggerPayload = {
  event: string;
  source?: string;
  data?: Record<string, unknown>;
  at?: string;
};

export function isN8nConfigured(): boolean {
  return Boolean(env.N8N_WEBHOOK_URL?.trim());
}

/** POST a JSON payload to your n8n Webhook node URL. */
export async function triggerN8nWebhook(
  payload: N8nTriggerPayload,
  webhookUrl?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = (webhookUrl ?? env.N8N_WEBHOOK_URL)?.trim();
  if (!url) {
    return { ok: false, error: "N8N_WEBHOOK_URL not set" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (env.N8N_WEBHOOK_SECRET?.trim()) {
    headers["Authorization"] = `Bearer ${env.N8N_WEBHOOK_SECRET.trim()}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        source: payload.source ?? "cortex",
        at: payload.at ?? new Date().toISOString()
      })
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text().catch(() => res.statusText) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
