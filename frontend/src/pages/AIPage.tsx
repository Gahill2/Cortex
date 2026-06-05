import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { AISuggestionChips, type SuggestionChip } from "../components/ai/AISuggestionChips";
import { AIProviderBanner } from "../components/ai/AIProviderBanner";
import { AILocalPcDialog, applyCloudFallback } from "../components/ai/AILocalPcDialog";
import { AIWorkspaceSidebar } from "../components/ai/AIWorkspaceSidebar";
import { useAIStatus } from "../hooks/useAIStatus";
import type { Tab } from "../tab";
import { useToastStore } from "../stores/toastStore";
import {
  type ChatAIProviderId,
  CHAT_AI_PROVIDER_LABELS,
  pickDefaultProvider,
  readStoredAIProvider,
  wantsLocalPcButOffline,
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

function providerBadgeClass(id: ChatAIProviderId | "none"): string {
  if (id === "ollama") return "ollama";
  if (id === "openai") return "openai";
  if (id === "kimi") return "kimi";
  if (id === "claude") return "anthropic";
  return "none";
}

type AIPreset = { id: string; name: string; description: string };

export const AIPage = ({
  onNavigate,
  activeTab = "ai",
}: {
  onNavigate: (tab: Tab) => void;
  activeTab?: Tab;
}) => {
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
  const { status, loading: statusLoading, refresh: fetchStatus } = useAIStatus(30_000);
  const [selectedProvider, setSelectedProvider] = useState<ChatAIProviderId>(
    () => readStoredAIProvider() ?? "kimi"
  );
  const [starting, setStarting] = useState(false);
  const [includeWorkspaceContext, setIncludeWorkspaceContext] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionChip[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [presetId, setPresetId] = useState("cortex");
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pcRetrying, setPcRetrying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSuggestionsLoading(true);
    api
      .get<{
        data?: { suggestions?: Array<{ id: string; label: string; prompt: string; category?: string }> };
      }>("/ai/suggestions")
      .then((r) => {
        const list = r.data?.data?.suggestions ?? [];
        setSuggestions(
          list.map((s) => ({
            id: s.id,
            label: s.label,
            prompt: s.prompt,
            description: s.category,
          })),
        );
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
    api
      .get<{ data?: { presets?: AIPreset[] } }>("/ai/presets")
      .then((r) => setPresets(r.data?.data?.presets ?? []))
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!status?.providers?.length) return;
    setSelectedProvider((prev) => {
      const meta = status.providers.find((p) => p.id === prev);
      if (meta?.available) return prev;
      if (prev === "ollama") return "ollama";
      return pickDefaultProvider(status.providers, status.defaultProvider);
    });
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

  const providers = status?.providers ?? [];

  const runSend = async (msg: string, provider: ChatAIProviderId = selectedProvider) => {
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg, timestamp: now() }]);
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", {
        message: msg,
        provider,
        includeWorkspaceContext,
      });
      const data = res.data?.data ?? res.data;
      if (data?.code === "OLLAMA_OFFLINE") {
        setPcDialogOpen(true);
        setPendingMessage(msg);
        setMessages((p) => p.slice(0, -1));
        return;
      }
      const reply: string = data?.reply ?? "…";
      const replyProvider: string = data?.provider;
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
          provider: replyProvider,
          timestamp: now(),
        },
      ]);
      if (replyProvider && replyProvider !== "none") void fetchStatus();
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

  const send = async (e?: FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? input).trim();
    if (!msg || loading) return;
    const meta = providers.find((p) => p.id === selectedProvider);
    if (selectedProvider === "ollama" && !meta?.available) {
      setPendingMessage(msg);
      setPcDialogOpen(true);
      return;
    }
    setInput("");
    await runSend(msg);
  };

  const handlePcUseCloud = (cloudId: ChatAIProviderId) => {
    applyCloudFallback(status, handleProviderChange);
    setPcDialogOpen(false);
    const msg = pendingMessage;
    setPendingMessage(null);
    if (msg) void runSend(msg, cloudId);
  };

  const handlePcRetry = async () => {
    setPcRetrying(true);
    try {
      await api.post("/ai/ollama/refresh");
      const res = await api.get("/ai/status");
      const data = (res.data?.data ?? res.data) as typeof status;
      if (data?.ollama) {
        handleProviderChange("ollama");
        setPcDialogOpen(false);
        const msg = pendingMessage;
        setPendingMessage(null);
        pushToast({ title: "PC online", message: `${data.ollamaPcName ?? "Ollama"} is reachable.`, tone: "success" });
        if (msg) void runSend(msg, "ollama");
      } else {
        pushToast({
          title: "Still offline",
          message: `No Ollama at ${data?.ollamaHost ?? "host"}. Turn on the PC or use cloud.`,
          tone: "neutral",
        });
      }
      void fetchStatus();
    } finally {
      setPcRetrying(false);
    }
  };

  const sendStarter = (text: string) => {
    const meta = providers.find((p) => p.id === selectedProvider);
    if (selectedProvider === "ollama" && !meta?.available) {
      setPendingMessage(text);
      setPcDialogOpen(true);
      return;
    }
    void runSend(text);
  };
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
                const label = p?.label ?? CHAT_AI_PROVIDER_LABELS[id];
                return (
                  <option key={id} value={id} disabled={!available}>
                    {label}
                    {p?.available ? ` · ${p.model}` : id === "ollama" ? " — offline" : " — not configured"}
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

      <AIProviderBanner status={status} loading={statusLoading} compact />

      {wantsLocalPcButOffline(status) && (
        <div className="ai-provider-banner ai-provider-banner--warn" role="status">
          <strong>
            {status?.ollamaPcName ?? "Local PC"} offline
          </strong>
          <p>
            Ollama at <code>{status?.ollamaHost}</code> isn&apos;t reachable. Send a message to choose cloud AI, or
            turn on your PC and use Check again.
          </p>
        </div>
      )}

      <AILocalPcDialog
        open={pcDialogOpen}
        status={status}
        onClose={() => {
          setPcDialogOpen(false);
          setPendingMessage(null);
        }}
        onUseCloud={handlePcUseCloud}
        onRetry={() => void handlePcRetry()}
        retrying={pcRetrying}
      />

      <div className="ai-workspace">
        <AIWorkspaceSidebar
          status={status}
          selectedProvider={selectedProvider}
          activeTab={activeTab}
          onNavigate={onNavigate}
        />

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

        {presets.length > 0 && (
          <div className="ai-presets-row">
            <span className="ai-presets-label">Persona</span>
            <div className="ai-presets-chips">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ai-preset-chip ${presetId === p.id ? "ai-preset-chip--active" : ""}`}
                  title={p.description}
                  onClick={() => setPresetId(p.id)}
                  disabled={loading}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {(messages.length <= 2 || input.trim().length > 0) && (
          <AISuggestionChips
            suggestions={suggestions}
            loading={suggestionsLoading}
            disabled={loading}
            filterText={input}
            onSelect={(p) => void sendStarter(p)}
            className="ai-suggestion-chips--in-chat"
          />
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
    </div>
  );
};
