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
let _ollamaCheckedAt = 0;

function ollamaCheckTtlMs(): number {
  const n = env.OLLAMA_CHECK_MS;
  return Number.isFinite(n) && n >= 5_000 ? n : 30_000;
}

/** Hostname from OLLAMA_BASE_URL for status UI (Tailscale PC, localhost, etc.). */
export function getOllamaHostLabel(): string {
  try {
    const u = new URL(env.OLLAMA_BASE_URL);
    if (u.hostname === "host.docker.internal") return "Docker host";
    return u.hostname;
  } catch {
    return "local";
  }
}

export function getOllamaPcLabel(): string {
  const name = env.OLLAMA_PC_NAME?.trim();
  return name || "Local PC";
}

async function checkOllama(force = false): Promise<boolean> {
  const now = Date.now();
  if (
    !force &&
    _ollamaAvailable !== null &&
    now - _ollamaCheckedAt < ollamaCheckTtlMs()
  ) {
    return _ollamaAvailable;
  }
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    _ollamaAvailable = res.ok;
  } catch {
    _ollamaAvailable = false;
  }
  _ollamaCheckedAt = now;
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
  return /credit balance|billing|quota|insufficient|recharge|exceeded_current_quota|suspended due to|account.*suspended|"code":\s*429/i.test(msg);
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
      throw new Error(
        `${getOllamaPcLabel()} is not reachable at ${getOllamaHostLabel()}. Turn on the PC and start Ollama, or choose a cloud model.`,
      );
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

const CLOUD_FAIL_TTL_MS = 10 * 60_000;
let cloudFailureUntil = 0;

function markCloudProvidersFailed(): void {
  cloudFailureUntil = Date.now() + CLOUD_FAIL_TTL_MS;
}

function clearCloudProviderFailure(): void {
  cloudFailureUntil = 0;
}

async function callFirstAvailable(
  providers: Array<{ name: string; run: () => Promise<AIResponse> }>,
): Promise<AIResponse> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider.run();
      clearCloudProviderFailure();
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider.name}: ${msg}`);
      console.warn(`[ai] ${provider.name} failed:`, msg);
    }
  }
  markCloudProvidersFailed();
  throw new Error(errors.join(" · ") || "No AI provider available");
}

/** True when any cloud API key is set (may still fail at runtime if out of credits). */
export function isCloudAiConfigured(): boolean {
  return Boolean(getKimiApiKey() || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY?.trim());
}

/** Cloud keys set and no recent failures (429, billing, network) from callAI. */
export function isCloudAiWorking(): boolean {
  if (!isCloudAiConfigured()) return false;
  return Date.now() >= cloudFailureUntil;
}

function buildCloudProviders(
  messages: AIMessage[],
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
): Array<{ name: string; run: () => Promise<AIResponse> }> {
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
  return cloudProviders;
}

async function callOllamaWithCacheReset(
  messages: AIMessage[],
  systemPrompt?: string,
  maxTokens?: number,
): Promise<AIResponse> {
  try {
    return await callOllama(messages, systemPrompt, maxTokens);
  } catch (e) {
    _ollamaAvailable = false;
    throw e;
  }
}

/** Cloud APIs first; Ollama only when cloud is unavailable or all cloud calls fail. */
export async function callAI(
  messages: AIMessage[],
  opts: {
    tier?: AITier;
    systemPrompt?: string;
    maxTokens?: number;
    /** @deprecated Cloud is always preferred when configured; Ollama is fallback only. */
    preferCloud?: boolean;
  } = {}
): Promise<AIResponse> {
  const { tier = "simple", systemPrompt, maxTokens } = opts;

  if (tier === "local") {
    if (!(await checkOllama())) {
      throw new Error("Ollama is not running. Start it with: ollama serve");
    }
    return callOllamaWithCacheReset(messages, systemPrompt, maxTokens);
  }

  const cloudProviders = buildCloudProviders(messages, systemPrompt, maxTokens);

  if (cloudProviders.length > 0) {
    try {
      return await callFirstAvailable(cloudProviders);
    } catch (cloudErr) {
      if (await checkOllama()) {
        console.warn("[ai] cloud providers failed, falling back to Ollama:", cloudErr);
        return callOllamaWithCacheReset(messages, systemPrompt, maxTokens);
      }
      throw cloudErr;
    }
  }

  if (await checkOllama()) {
    return callOllamaWithCacheReset(messages, systemPrompt, maxTokens);
  }

  throw new Error(
    "No AI provider available. Set KIMI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY, or run: npm run server:ollama:setup",
  );
}

export async function isOllamaAvailable(): Promise<boolean> {
  return checkOllama();
}

export async function getAIStatus(): Promise<{
  ollama: boolean;
  ollamaModel: string;
  ollamaHost: string;
  ollamaPcName: string;
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
  const ollamaPcName = getOllamaPcLabel();
  const ollamaHost = getOllamaHostLabel();
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
    const remote =
      ollamaHost !== "localhost" && ollamaHost !== "127.0.0.1" && ollamaHost !== "Docker host";
    if (remote) {
      hints.push(
        `${ollamaPcName} (${ollamaHost}) is offline — turn on the PC and Ollama, or use a cloud model in AI chat.`,
      );
    } else {
      hints.push("Cloud AI is active. Ollama is optional — only needed if you want a free local fallback.");
    }
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
      label: ollamaPcName,
      available: ollama,
      model: env.OLLAMA_MODEL,
    },
  ];

  const defaultProvider: ChatAIProviderId | null = kimi
    ? "kimi"
    : anthropic
      ? "claude"
      : openai
        ? "openai"
        : ollama
          ? "ollama"
          : null;

  const activeProvider = defaultProvider === "kimi"
    ? "kimi"
    : defaultProvider === "claude"
      ? "anthropic"
      : defaultProvider ?? "none";

  return {
    ollama,
    ollamaModel: env.OLLAMA_MODEL,
    ollamaHost,
    ollamaPcName,
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
  _ollamaCheckedAt = 0;
  return checkOllama(true);
}
