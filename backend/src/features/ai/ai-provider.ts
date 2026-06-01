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
export type ChatAIProviderId = "claude" | "openai" | "ollama" | "kimi";

export type AIProviderId = "ollama" | "anthropic" | "openai" | "kimi";

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

const CLAUDE_MODEL = env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

export function isAiBillingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /credit balance|billing|quota|insufficient|recharge|exceeded_current_quota|suspended due to/i.test(msg);
}

/** User-facing chat/API error when a provider call fails. */
export function formatAiErrorForUser(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (!isAiBillingError(err)) {
    return `⚠️ AI error: ${msg.slice(0, 280)}`;
  }
  if (/moonshot|kimi/i.test(msg)) {
    return "⚠️ Kimi credits exhausted. Recharge at platform.moonshot.cn, run Ollama locally, or pick another model in AI chat.";
  }
  if (/anthropic|credit balance/i.test(msg)) {
    return "⚠️ Claude API credits exhausted. Add credits at console.anthropic.com, run Ollama, or switch to Kimi.";
  }
  if (/openai/i.test(msg)) {
    return "⚠️ OpenAI quota exhausted. Check billing at platform.openai.com or use Ollama locally.";
  }
  return "⚠️ AI quota exhausted. Recharge your cloud provider or run Ollama (ollama serve + OLLAMA_BASE_URL in api.env).";
}

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

// ── Kimi / Moonshot (OpenAI-compatible) ──────────────────────────────────────

function getKimiApiKey(): string | undefined {
  const key = env.KIMI_API_KEY?.trim() || env.MOONSHOT_API_KEY?.trim();
  return key || undefined;
}

const KIMI_CODING_BASE = "https://api.kimi.com/coding/v1";
const MOONSHOT_INTL_BASE = "https://api.moonshot.ai/v1";
const MOONSHOT_CN_BASE = "https://api.moonshot.cn/v1";

function resolveKimiConfig(key: string): { baseUrls: string[]; model: string } {
  const customBase = env.KIMI_BASE_URL?.trim();
  const customModel = env.KIMI_MODEL?.trim();
  if (key.startsWith("sk-kimi-")) {
    return {
      baseUrls: [(customBase || KIMI_CODING_BASE).replace(/\/$/, "")],
      model: customModel || "kimi-for-coding",
    };
  }
  if (customBase) {
    return {
      baseUrls: [customBase.replace(/\/$/, "")],
      model: customModel || "kimi-k2.6",
    };
  }
  // Moonshot keys are region-specific — try both when KIMI_BASE_URL is unset.
  return {
    baseUrls: [MOONSHOT_CN_BASE, MOONSHOT_INTL_BASE],
    model: customModel || "kimi-k2.6",
  };
}

async function callKimiAt(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt: string | undefined,
  maxTokens: number,
): Promise<AIResponse> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const err = new Error(`Kimi error: ${res.status}${errBody ? ` — ${errBody.slice(0, 200)}` : ""}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, provider: "kimi", model };
}

async function callKimi(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens = 2048
): Promise<AIResponse> {
  const apiKey = getKimiApiKey();
  if (!apiKey) {
    throw new Error("Kimi API key not configured (set KIMI_API_KEY or MOONSHOT_API_KEY)");
  }
  const { baseUrls, model } = resolveKimiConfig(apiKey);

  const errors: string[] = [];
  for (const baseUrl of baseUrls) {
    try {
      return await callKimiAt(baseUrl, model, apiKey, messages, systemPrompt, maxTokens);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      const status = (e as Error & { status?: number }).status;
      // Only retry another region on auth failure.
      if (status === 401 && baseUrls.length > 1) continue;
      throw e instanceof Error ? e : new Error(msg);
    }
  }
  throw new Error(errors.join(" · ") || "Kimi request failed");
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

  if (provider === "kimi") {
    return callKimi(messages, systemPrompt, maxTokens);
  }

  return callAnthropic(messages, systemPrompt, maxTokens);
}

// ── Tiered routing (background / legacy) ─────────────────────────────────────

async function callFirstAvailable(
  providers: Array<{ name: string; run: () => Promise<AIResponse> }>,
): Promise<AIResponse> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await provider.run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider.name}: ${msg}`);
      console.warn(`[ai] ${provider.name} failed:`, msg);
    }
  }
  throw new Error(errors.join(" · ") || "No AI provider available");
}

export async function callAI(
  messages: AIMessage[],
  opts: {
    tier?: AITier;
    systemPrompt?: string;
    maxTokens?: number;
    /** Skip Ollama — use Anthropic/OpenAI first (better for structured JSON tasks). */
    preferCloud?: boolean;
  } = {}
): Promise<AIResponse> {
  const { tier = "simple", systemPrompt, maxTokens, preferCloud = false } = opts;

  if (tier === "local") {
    if (!(await checkOllama())) {
      throw new Error("Ollama is not running. Start it with: ollama serve");
    }
    return callOllama(messages, systemPrompt, maxTokens);
  }

  const cloudProviders: Array<{ name: string; run: () => Promise<AIResponse> }> = [];
  const kimiKey = getKimiApiKey();
  if (kimiKey) {
    cloudProviders.push({ name: "kimi", run: () => callKimi(messages, systemPrompt, maxTokens) });
  }
  if (env.ANTHROPIC_API_KEY) {
    cloudProviders.push({ name: "anthropic", run: () => callAnthropic(messages, systemPrompt, maxTokens) });
  }
  if (env.OPENAI_API_KEY?.trim()) {
    cloudProviders.push({ name: "openai", run: () => callOpenAI(messages, systemPrompt, maxTokens) });
  }

  if (tier === "complex" || preferCloud) {
    if (cloudProviders.length === 0) {
      if (await checkOllama()) {
        return callOllama(messages, systemPrompt, maxTokens);
      }
      throw new Error(
        preferCloud
          ? "No cloud AI configured. Set KIMI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY — or start Ollama locally."
          : "No AI provider configured."
      );
    }
    try {
      return await callFirstAvailable(cloudProviders);
    } catch (cloudErr) {
      if (await checkOllama()) {
        console.warn("[ai] cloud providers failed, falling back to Ollama:", cloudErr);
        return callOllama(messages, systemPrompt, maxTokens);
      }
      throw cloudErr;
    }
  }

  const providers: Array<{ name: string; run: () => Promise<AIResponse> }> = [];
  if (await checkOllama()) {
    providers.push({
      name: "ollama",
      run: async () => {
        try {
          return await callOllama(messages, systemPrompt, maxTokens);
        } catch (e) {
          _ollamaAvailable = false;
          throw e;
        }
      },
    });
  }
  providers.push(...cloudProviders);

  if (providers.length === 0) {
    throw new Error("No AI provider configured. Start Ollama or set KIMI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY.");
  }

  return callFirstAvailable(providers);
}

export async function getAIStatus(): Promise<{
  ollama: boolean;
  ollamaModel: string;
  anthropic: boolean;
  kimi: boolean;
  kimiModel: string;
  openai: boolean;
  openaiModel: string;
  /** @deprecated use `defaultProvider` */
  activeProvider: "ollama" | "anthropic" | "openai" | "kimi" | "none";
  providers: AIProviderStatus[];
  defaultProvider: ChatAIProviderId | null;
  /** Actionable setup hints for homelab / settings UI */
  hints: string[];
}> {
  const ollama = await checkOllama();
  const anthropic = !!env.ANTHROPIC_API_KEY;
  const kimi = !!getKimiApiKey();
  const kimiModel = kimi ? resolveKimiConfig(getKimiApiKey()!).model : "";
  const openai = !!env.OPENAI_API_KEY?.trim();

  const hints: string[] = [];
  const cloudConfigured = kimi || anthropic || openai;
  if (!cloudConfigured && !ollama) {
    hints.push("No AI configured — set KIMI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in api.env.");
  }
  if (cloudConfigured && !ollama) {
    hints.push("Run Ollama on the host for free fallback: ollama serve, then OLLAMA_BASE_URL=http://host.docker.internal:11434 in api.env.");
  }
  if (kimi && !ollama && !anthropic && !openai) {
    hints.push("Kimi is your only provider — recharge at platform.moonshot.cn if requests fail with quota errors.");
  }

  const providers: AIProviderStatus[] = [
    {
      id: "kimi",
      label: "Kimi",
      available: kimi,
      model: kimiModel || "kimi-k2.5",
    },
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

  const defaultProvider: ChatAIProviderId | null = kimi
    ? "kimi"
    : ollama
      ? "ollama"
      : openai
        ? "openai"
        : anthropic
          ? "claude"
          : null;

  const activeProvider = defaultProvider === "kimi"
    ? "kimi"
    : defaultProvider === "claude"
      ? "anthropic"
      : defaultProvider ?? "none";

  return {
    ollama,
    ollamaModel: env.OLLAMA_MODEL,
    anthropic,
    kimi,
    kimiModel,
    openai,
    openaiModel: env.OPENAI_MODEL,
    activeProvider,
    providers,
    defaultProvider,
    hints,
  };
}

export function resetOllamaCache() {
  _ollamaAvailable = null;
}
