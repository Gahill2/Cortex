import { env } from "../../config/env.js";

const DEFAULT_URL = "http://127.0.0.1:3111";

export function getAgentmemoryBaseUrl(): string {
  return (env.AGENTMEMORY_URL || DEFAULT_URL).replace(/\/$/, "");
}

export function isAgentmemoryConfigured(): boolean {
  return Boolean(getAgentmemoryBaseUrl());
}

export type AgentmemoryHealth = {
  ok: boolean;
  url: string;
  detail?: string;
};

export async function pingAgentmemory(): Promise<AgentmemoryHealth> {
  const url = getAgentmemoryBaseUrl();
  try {
    const res = await fetch(`${url}/agentmemory/health`, {
      signal: AbortSignal.timeout(3_000)
    });
    if (!res.ok) {
      return { ok: false, url, detail: `HTTP ${res.status}` };
    }
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      url,
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}

export type MemorySearchHit = {
  text?: string;
  content?: string;
  session_id?: string;
  score?: number;
};

export async function agentmemorySmartSearch(
  project: string,
  query: string,
  limit = 12
): Promise<MemorySearchHit[]> {
  const url = getAgentmemoryBaseUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.AGENTMEMORY_SECRET) {
    headers.Authorization = `Bearer ${env.AGENTMEMORY_SECRET}`;
  }

  const res = await fetch(`${url}/agentmemory/smart-search`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ project, query, limit })
  });

  if (!res.ok) {
    throw new Error(`agentmemory search failed: HTTP ${res.status}`);
  }

  const body = (await res.json()) as { results?: MemorySearchHit[]; data?: { results?: MemorySearchHit[] } };
  return body.results ?? body.data?.results ?? [];
}

export type RememberInput = {
  project: string;
  userMessage: string;
  assistantReply: string;
  conversationId?: string;
};

export async function agentmemoryRemember(input: RememberInput): Promise<boolean> {
  const url = getAgentmemoryBaseUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.AGENTMEMORY_SECRET) {
    headers.Authorization = `Bearer ${env.AGENTMEMORY_SECRET}`;
  }

  try {
    const res = await fetch(`${url}/agentmemory/remember`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        project: input.project,
        conversationId: input.conversationId,
        text: `User: ${input.userMessage}\nAssistant: ${input.assistantReply}`
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatMemoryContextHits(
  hits: MemorySearchHit[],
  limit = 8
): string {
  const lines = hits
    .slice(0, limit)
    .map((h, i) => `${i + 1}. ${(h.text ?? h.content ?? "").trim()}`)
    .filter((line) => line.length > 2);
  if (!lines.length) return "";
  return `Relevant long-term memory:\n${lines.join("\n")}`;
}
