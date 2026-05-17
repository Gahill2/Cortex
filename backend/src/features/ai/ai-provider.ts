/**
 * Tiered AI provider — Ollama (local), OpenAI (ChatGPT), Anthropic (Claude).
 *
 * Chat UI can pick a provider explicitly via `callAIWithProvider`.
 * Background jobs use `callAI` with tier routing (Ollama → Anthropic fallback).
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";

export type AIMessage = { role: "user" | "assistant"; content: string };
export type AITier = "simple" | "complex" | "local";

/** Chat dropdown ids — map to backend implementations. */
export type ChatAIProviderId = "claude" | "openai" | "ollama";

export type AIProviderId = "ollama" | "anthropic" | "openai";

export type AIResponse = {
  text: string;
  provider: AIProviderId;
  model: string;
};

export type AIProviderStatus = {
  id: ChatAIProviderId;
  label: string;
  available: boolean;
  model: string;
};

// ── Ollama ───────────────────────────────────────────────────────────────────

let _ollamaAvailable: boolean | null = null;

async function checkOllama(): Promise<boolean> {
  if (_ollamaAvailable !== null) return _ollamaAvailable;
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    _ollamaAvailable = res.ok;
  } catch {
    _ollamaAvailable = false;
  }
  return _ollamaAvailable;
}

async function callOllama(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens = 2048
): Promise<AIResponse> {
  const body = {
    model: env.OLLAMA_MODEL,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages,
    ],
    stream: false,
    options: { num_predict: maxTokens },
  };

  const res = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? "";
  return { text, provider: "ollama", model: env.OLLAMA_MODEL };
}

// ── Anthropic (Claude) ─────────────────────────────────────────────────────

const CLAUDE_MODEL = "claude-3-5-haiku-20241022";

async function callAnthropic(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens = 2048
): Promise<AIResponse> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key not configured (set ANTHROPIC_API_KEY)");
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  });
  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  return { text, provider: "anthropic", model: CLAUDE_MODEL };
}

// ── OpenAI (ChatGPT) ─────────────────────────────────────────────────────────

async function callOpenAI(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens = 2048
): Promise<AIResponse> {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new Error("OpenAI API key not configured (set OPENAI_API_KEY)");
  }

  const base = env.OPENAI_BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI error: ${res.status}${errBody ? ` — ${errBody.slice(0, 200)}` : ""}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, provider: "openai", model: env.OPENAI_MODEL };
}

// ── Explicit provider (chat UI) ──────────────────────────────────────────────

export async function callAIWithProvider(
  messages: AIMessage[],
  provider: ChatAIProviderId,
  opts: {
    systemPrompt?: string;
    maxTokens?: number;
  } = {}
): Promise<AIResponse> {
  const { systemPrompt, maxTokens } = opts;

  if (provider === "ollama") {
    if (!(await checkOllama())) {
      throw new Error("Ollama is not running. Start it with: ollama serve");
    }
    return callOllama(messages, systemPrompt, maxTokens);
  }

  if (provider === "openai") {
    return callOpenAI(messages, systemPrompt, maxTokens);
  }

  return callAnthropic(messages, systemPrompt, maxTokens);
}

// ── Tiered routing (background / legacy) ─────────────────────────────────────

export async function callAI(
  messages: AIMessage[],
  opts: {
    tier?: AITier;
    systemPrompt?: string;
    maxTokens?: number;
  } = {}
): Promise<AIResponse> {
  const { tier = "simple", systemPrompt, maxTokens } = opts;

  if (tier === "complex") {
    return callAnthropic(messages, systemPrompt, maxTokens);
  }

  if (tier === "local") {
    if (!(await checkOllama())) {
      throw new Error("Ollama is not running. Start it with: ollama serve");
    }
    return callOllama(messages, systemPrompt, maxTokens);
  }

  if (await checkOllama()) {
    try {
      return await callOllama(messages, systemPrompt, maxTokens);
    } catch (e) {
      console.warn("[ai] Ollama failed, falling back to Anthropic:", (e as Error).message);
      _ollamaAvailable = false;
    }
  }

  if (env.ANTHROPIC_API_KEY) {
    return callAnthropic(messages, systemPrompt, maxTokens);
  }

  if (env.OPENAI_API_KEY?.trim()) {
    return callOpenAI(messages, systemPrompt, maxTokens);
  }

  throw new Error("No AI provider configured");
}

export async function getAIStatus(): Promise<{
  ollama: boolean;
  ollamaModel: string;
  anthropic: boolean;
  openai: boolean;
  openaiModel: string;
  /** @deprecated use `defaultProvider` */
  activeProvider: "ollama" | "anthropic" | "openai" | "none";
  providers: AIProviderStatus[];
  defaultProvider: ChatAIProviderId | null;
}> {
  const ollama = await checkOllama();
  const anthropic = !!env.ANTHROPIC_API_KEY;
  const openai = !!env.OPENAI_API_KEY?.trim();

  const providers: AIProviderStatus[] = [
    {
      id: "claude",
      label: "Claude",
      available: anthropic,
      model: CLAUDE_MODEL,
    },
    {
      id: "openai",
      label: "ChatGPT",
      available: openai,
      model: env.OPENAI_MODEL,
    },
    {
      id: "ollama",
      label: "Ollama",
      available: ollama,
      model: env.OLLAMA_MODEL,
    },
  ];

  const defaultProvider: ChatAIProviderId | null = ollama
    ? "ollama"
    : openai
      ? "openai"
      : anthropic
        ? "claude"
        : null;

  const activeProvider = defaultProvider === "claude"
    ? "anthropic"
    : defaultProvider ?? "none";

  return {
    ollama,
    ollamaModel: env.OLLAMA_MODEL,
    anthropic,
    openai,
    openaiModel: env.OPENAI_MODEL,
    activeProvider,
    providers,
    defaultProvider,
  };
}

export function resetOllamaCache() {
  _ollamaAvailable = null;
}
