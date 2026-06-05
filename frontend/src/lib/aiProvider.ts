/** User-facing chat provider ids (match backend /ai/chat `provider` field). */
export type ChatAIProviderId = "claude" | "openai" | "ollama" | "kimi";

export const CORTEX_AI_PROVIDER_KEY = "cortex_ai_provider";

export const CHAT_AI_PROVIDER_LABELS: Record<ChatAIProviderId, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  ollama: "Ollama",
  kimi: "Kimi",
};

export type AIProviderOption = {
  id: ChatAIProviderId;
  label: string;
  available: boolean;
  model: string;
};

export function readStoredAIProvider(): ChatAIProviderId | null {
  try {
    const raw = localStorage.getItem(CORTEX_AI_PROVIDER_KEY);
    if (raw === "claude" || raw === "openai" || raw === "ollama" || raw === "kimi") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredAIProvider(id: ChatAIProviderId): void {
  try {
    localStorage.setItem(CORTEX_AI_PROVIDER_KEY, id);
  } catch {
    /* ignore */
  }
}

const CLOUD_PROVIDER_ORDER: ChatAIProviderId[] = ["kimi", "claude", "openai"];

/** User prefers local Ollama (gaming PC) but it's not reachable right now. */
export function wantsLocalPcButOffline(status: {
  ollama: boolean;
  providers: AIProviderOption[];
} | null): boolean {
  if (!status || status.ollama) return false;
  const stored = readStoredAIProvider();
  if (stored === "ollama") return true;
  const ollamaMeta = status.providers.find((p) => p.id === "ollama");
  return Boolean(ollamaMeta && !ollamaMeta.available);
}

export function pickDefaultProvider(
  providers: AIProviderOption[],
  fallback: ChatAIProviderId | null
): ChatAIProviderId {
  const stored = readStoredAIProvider();
  if (stored && stored !== "ollama" && providers.find((p) => p.id === stored)?.available) {
    return stored;
  }
  if (fallback && fallback !== "ollama" && providers.find((p) => p.id === fallback)?.available) {
    return fallback;
  }
  for (const id of CLOUD_PROVIDER_ORDER) {
    if (providers.find((p) => p.id === id)?.available) return id;
  }
  if (providers.find((p) => p.id === "ollama")?.available) return "ollama";
  return providers.find((p) => p.available)?.id ?? "claude";
}
