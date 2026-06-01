import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { AIProviderBanner } from "../components/ai/AIProviderBanner";
import { useAIStatus } from "../hooks/useAIStatus";
import { useToastStore } from "../stores/toastStore";
import {
  type ChatAIProviderId,
  CHAT_AI_PROVIDER_LABELS,
  pickDefaultProvider,
  readStoredAIProvider,
  writeStoredAIProvider,
} from "../lib/aiProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  timestamp: string;
}

interface ElectronBridge {
  isElectron?: boolean;
  startOllama?: () => Promise<{ ok: boolean; error?: string }>;
  ollamaStatus?: () => Promise<{ running: boolean }>;
}

const win = window as unknown as { electron?: ElectronBridge };
const isElectron = !!win.electron?.isElectron;

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const STARTERS = [
  "Summarize my day",
  "What tasks are due soon?",
  "Draft an email reply",
  "What's on my calendar today?",
  "Help me write a task description",
];

function providerBadgeClass(id: ChatAIProviderId | "none"): string {
  if (id === "ollama") return "ollama";
  if (id === "openai") return "openai";
  if (id === "kimi") return "kimi";
  if (id === "claude") return "anthropic";
  return "none";
}

export const AIPage = () => {
  const pushToast = useToastStore((s) => s.push);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "Hi, I'm Cortex AI. Pick a model below, then ask me anything.",
      timestamp: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { status, loading: statusLoading, refresh: fetchStatus } = useAIStatus();
  const [selectedProvider, setSelectedProvider] = useState<ChatAIProviderId>(
    () => readStoredAIProvider() ?? "kimi"
  );
  const [starting, setStarting] = useState(false);
  const [includeWorkspaceContext, setIncludeWorkspaceContext] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!status?.providers?.length) return;
    setSelectedProvider((prev) =>
      status.providers.find((p) => p.id === prev)?.available
        ? prev
        : pickDefaultProvider(status.providers, status.defaultProvider)
    );
  }, [status]);

  const handleProviderChange = (id: ChatAIProviderId) => {
    setSelectedProvider(id);
    writeStoredAIProvider(id);
  };

  const handleStartOllama = async () => {
    if (!win.electron?.startOllama) return;
    setStarting(true);
    try {
      const result = await win.electron.startOllama();
      if (result.ok) {
        await api.post("/ai/ollama/refresh");
        await fetchStatus();
        handleProviderChange("ollama");
      } else {
        pushToast({
          title: "Failed to start Ollama",
          message: `${result.error ?? "unknown error"}. Make sure Ollama is installed: https://ollama.com`,
          tone: "error",
          dismissMs: 6000,
        });
      }
    } catch {
      pushToast({
        title: "Could not start Ollama",
        message: "Make sure it's installed at https://ollama.com",
        tone: "error",
        dismissMs: 6000,
      });
    } finally {
      setStarting(false);
    }
  };

  const postChat = async (msg: string) => {
    const res = await api.post("/ai/chat", {
      message: msg,
      provider: selectedProvider,
      includeWorkspaceContext,
    });
    const data = res.data?.data ?? res.data;
    const reply: string = data?.reply ?? "…";
    const provider: string = data?.provider;
    if (data?.obsidianLogged) {
      pushToast({
        title: "Saved to vault",
        message: "This exchange was appended to your Obsidian AI log.",
        tone: "success",
        dismissMs: 4000,
      });
    }
    setMessages((p) => [
      ...p,
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        provider,
        timestamp: now(),
      },
    ]);
    if (provider && provider !== "none") void fetchStatus();
  };

  const send = async (e?: FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? input).trim();
    if (!msg || loading) return;
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg, timestamp: now() }]);
    setInput("");
    setLoading(true);
    try {
      await postChat(msg);
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Could not reach the server.",
          timestamp: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendStarter = (text: string) => {
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: text, timestamp: now() }]);
    setLoading(true);
    postChat(text)
      .catch(() => {
        setMessages((p) => [
          ...p,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: "Could not reach the server.",
            timestamp: now(),
          },
        ]);
      })
      .finally(() => setLoading(false));
  };

  const providers = status?.providers ?? [];
  const selectedMeta = providers.find((p) => p.id === selectedProvider);
  const providerLabel = selectedMeta
    ? `${selectedMeta.label}${selectedMeta.available ? "" : " (unavailable)"}`
    : CHAT_AI_PROVIDER_LABELS[selectedProvider];

  return (
    <div className="page ai-page">
      <div className="page-titlebar flex-wrap gap-2 gap-md-3 align-items-center">
        <h1 className="page-title mb-0">AI Assistant</h1>
        <div className="d-flex flex-wrap align-items-center gap-2 ms-md-auto">
          <label className="ai-provider-select-wrap">
            <span className="ai-provider-select-label">Model</span>
            <select
              className="ai-provider-select"
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as ChatAIProviderId)}
              disabled={loading}
              aria-label="AI model"
            >
              {(["kimi", "claude", "openai", "ollama"] as const).map((id) => {
                const p = providers.find((x) => x.id === id);
                const available = p?.available ?? false;
                return (
                  <option key={id} value={id} disabled={!available}>
                    {CHAT_AI_PROVIDER_LABELS[id]}
                    {p?.available ? ` · ${p.model}` : " — not configured"}
                  </option>
                );
              })}
            </select>
          </label>
          {providerLabel && (
            <span
              className={`ai-provider-badge ai-provider-badge--${providerBadgeClass(
                selectedMeta?.available ? selectedProvider : "none"
              )}`}
            >
              {providerLabel}
            </span>
          )}
          {isElectron && status && !status.ollama && selectedProvider === "ollama" && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: "0.8rem" }}
              onClick={() => void handleStartOllama()}
              disabled={starting}
            >
              {starting ? "Starting Ollama…" : "Start Ollama"}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: "0.8rem" }}
            onClick={() =>
              setMessages([
                {
                  id: "init",
                  role: "assistant",
                  content: "New conversation started.",
                  timestamp: now(),
                },
              ])
            }
          >
            New Chat
          </button>
        </div>
      </div>

      <AIProviderBanner status={status} loading={statusLoading} />

      <div className="ai-layout">
        <div className="ai-messages">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ai-msg ai-msg--user">
                <div className="ai-msg-bubble">{m.content}</div>
                <span className="ai-msg-time">{m.timestamp}</span>
              </div>
            ) : (
              <div key={m.id} className="ai-msg ai-msg--assistant">
                <div className="ai-msg-inner">
                  <span className="ai-msg-icon" aria-hidden>
                    ✦
                  </span>
                  <div className="ai-msg-bubble">{m.content}</div>
                </div>
                <span className="ai-msg-time">
                  {m.timestamp}
                  {m.provider && m.provider !== "none" ? ` · ${m.provider}` : ""}
                </span>
              </div>
            )
          )}
          {loading && (
            <div className="ai-msg ai-msg--assistant">
              <div className="ai-msg-inner">
                <span className="ai-msg-icon" aria-hidden>
                  ✦
                </span>
                <div className="ai-msg-bubble">
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="ai-starters">
            {STARTERS.map((s) => (
              <button key={s} type="button" className="ai-starter-chip" onClick={() => sendStarter(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form className="ai-composer" onSubmit={send}>
          <label className="ai-context-toggle">
            <input
              type="checkbox"
              checked={includeWorkspaceContext}
              onChange={(e) => setIncludeWorkspaceContext(e.target.checked)}
              disabled={loading}
            />
            <span>Include Notion + Obsidian context</span>
          </label>
          <textarea
            ref={inputRef}
            className="ai-composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message with ${CHAT_AI_PROVIDER_LABELS[selectedProvider]}… (Enter to send)`}
            rows={3}
            disabled={loading}
          />
          <button type="submit" className="btn-primary ai-send-btn" disabled={loading || !input.trim()}>
            {loading ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
};
