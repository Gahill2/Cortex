/** User-facing chat provider ids (match backend /ai/chat `provider` field). */
export type ChatAIProviderId = "claude" | "openai" | "ollama";

export const CORTEX_AI_PROVIDER_KEY = "cortex_ai_provider";

export const CHAT_AI_PROVIDER_LABELS: Record<ChatAIProviderId, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  ollama: "Ollama",
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
    if (raw === "claude" || raw === "openai" || raw === "ollama") return raw;
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

export function pickDefaultProvider(
  providers: AIProviderOption[],
  fallback: ChatAIProviderId | null
): ChatAIProviderId {
  const stored = readStoredAIProvider();
  if (stored && providers.find((p) => p.id === stored)?.available) return stored;
  if (fallback && providers.find((p) => p.id === fallback)?.available) return fallback;
  const first = providers.find((p) => p.available);
  return first?.id ?? "claude";
}
