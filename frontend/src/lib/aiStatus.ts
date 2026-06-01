import type { AIProviderOption, ChatAIProviderId } from "./aiProvider";

export type AIStatusPayload = {
  ollama: boolean;
  ollamaModel: string;
  anthropic: boolean;
  kimi?: boolean;
  kimiModel?: string;
  openai: boolean;
  openaiModel: string;
  activeProvider: "ollama" | "anthropic" | "openai" | "kimi" | "none";
  providers: AIProviderOption[];
  defaultProvider: ChatAIProviderId | null;
  hints?: string[];
};

export function countAvailableProviders(status: AIStatusPayload | null): number {
  return status?.providers.filter((p) => p.available).length ?? 0;
}

export function hasLocalFallback(status: AIStatusPayload | null): boolean {
  return Boolean(status?.ollama);
}

export function primaryCloudProvider(status: AIStatusPayload | null): AIProviderOption | null {
  if (!status?.providers.length) return null;
  const order: ChatAIProviderId[] = ["kimi", "claude", "openai"];
  for (const id of order) {
    const p = status.providers.find((x) => x.id === id && x.available);
    if (p) return p;
  }
  return null;
}
