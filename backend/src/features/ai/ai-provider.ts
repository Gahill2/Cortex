/**
 * Tiered AI provider — Ollama (local, free) for simple/structured tasks,
 * Anthropic (API) for complex reasoning. Falls back gracefully.
 *
 * Complexity tiers:
 *   "simple"  → try Ollama first, fall back to Anthropic
 *   "complex" → Anthropic only
 *   "local"   → Ollama only, throw if unavailable
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";

export type AIMessage = { role: "user" | "assistant"; content: string };
export type AITier = "simple" | "complex" | "local";

export type AIResponse = {
  text: string;
  provider: "ollama" | "anthropic";
  model: string;
};

// ── Ollama ───────────────────────────────────────────────────────────────────

let _ollamaAvailable: boolean | null = null; // cached per-process

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

// ── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens = 2048
): Promise<AIResponse> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key not configured");
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = "claude-3-5-haiku-20241022";
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  });
  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  return { text, provider: "anthropic", model };
}

// ── Public API ────────────────────────────────────────────────────────────────

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

  // "simple" — try Ollama, fall back to Anthropic
  if (await checkOllama()) {
    try {
      return await callOllama(messages, systemPrompt, maxTokens);
    } catch (e) {
      console.warn("[ai] Ollama failed, falling back to Anthropic:", (e as Error).message);
      _ollamaAvailable = false; // don't retry Ollama this session
    }
  }

  return callAnthropic(messages, systemPrompt, maxTokens);
}

/** Returns which providers are currently available */
export async function getAIStatus(): Promise<{
  ollama: boolean;
  ollamaModel: string;
  anthropic: boolean;
  activeProvider: "ollama" | "anthropic" | "none";
}> {
  const ollama = await checkOllama();
  const anthropic = !!env.ANTHROPIC_API_KEY;
  return {
    ollama,
    ollamaModel: env.OLLAMA_MODEL,
    anthropic,
    activeProvider: ollama ? "ollama" : anthropic ? "anthropic" : "none",
  };
}

/** Reset Ollama availability cache (useful after user starts Ollama mid-session) */
export function resetOllamaCache() {
  _ollamaAvailable = null;
}
