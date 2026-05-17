import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  timestamp: string;
}

interface AIStatus {
  ollama: boolean;
  ollamaModel: string;
  anthropic: boolean;
  activeProvider: "ollama" | "anthropic" | "none";
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

export const AIPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, or questions.", timestamp: now() }
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState<AIStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [includeWorkspaceContext, setIncludeWorkspaceContext] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get("/ai/status");
      setStatus(res.data?.data ?? res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const handleStartOllama = async () => {
    if (!win.electron?.startOllama) return;
    setStarting(true);
    try {
      const result = await win.electron.startOllama();
      if (result.ok) {
        await api.post("/ai/ollama/refresh");
        await fetchStatus();
      } else {
        alert(`Failed to start Ollama: ${result.error ?? "unknown error"}\n\nMake sure Ollama is installed: https://ollama.com`);
      }
    } catch {
      alert("Could not start Ollama. Make sure it's installed at https://ollama.com");
    } finally {
      setStarting(false);
    }
  };

  const send = async (e?: FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? input).trim();
    if (!msg || loading) return;
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg, timestamp: now() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", { message: msg, includeWorkspaceContext });
      const data = res.data?.data ?? res.data;
      const reply: string = data?.reply ?? "…";
      const provider: string = data?.provider;
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: reply, provider, timestamp: now() }]);
      if (provider && status && provider !== status.activeProvider) void fetchStatus();
    } catch {
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: "Could not reach the server.", timestamp: now() }]);
    } finally {
      setLoading(false);
    }
  };

  const sendStarter = (text: string) => {
    setInput(text);
    // small delay so state settles before send reads it
    setTimeout(() => {
      setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: text, timestamp: now() }]);
      setInput("");
      setLoading(true);
      api.post("/ai/chat", { message: text, includeWorkspaceContext })
        .then((res) => {
          const data = res.data?.data ?? res.data;
          const reply: string = data?.reply ?? "…";
          const provider: string = data?.provider;
          setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: reply, provider, timestamp: now() }]);
          if (provider && status && provider !== status.activeProvider) void fetchStatus();
        })
        .catch(() => {
          setMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: "Could not reach the server.", timestamp: now() }]);
        })
        .finally(() => setLoading(false));
    }, 0);
  };

  const activeProvider = status?.activeProvider ?? "none";

  const providerLabel = status
    ? status.activeProvider === "ollama"
      ? `Ollama (${status.ollamaModel})`
      : status.activeProvider === "anthropic"
      ? "Anthropic"
      : "No AI"
    : null;

  return (
    <div className="page ai-page">
      <div className="page-titlebar flex-wrap gap-2 gap-md-3 align-items-center">
        <h1 className="page-title mb-0">AI Assistant</h1>
        <div className="d-flex flex-wrap align-items-center gap-2 ms-md-auto">
          {providerLabel && (
            <span className={`ai-provider-badge ai-provider-badge--${activeProvider}`}>
              {providerLabel}
            </span>
          )}
          {isElectron && status && !status.ollama && (
            <button
              className="btn-ghost"
              style={{ fontSize: "0.8rem" }}
              onClick={() => void handleStartOllama()}
              disabled={starting}
            >
              {starting ? "Starting Ollama…" : "Start Ollama"}
            </button>
          )}
          <button
            className="btn-primary"
            style={{ fontSize: "0.8rem" }}
            onClick={() => setMessages([{ id: "init", role: "assistant", content: "New conversation started.", timestamp: now() }])}
          >
            ✦ New Chat
          </button>
        </div>
      </div>

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
                  <span className="ai-msg-icon">✦</span>
                  <div className="ai-msg-bubble">{m.content}</div>
                </div>
                <span className="ai-msg-time">{m.timestamp}</span>
              </div>
            )
          )}
          {loading && (
            <div className="ai-msg ai-msg--assistant">
              <div className="ai-msg-inner">
                <span className="ai-msg-icon">✦</span>
                <div className="ai-msg-bubble">
                  <div className="ai-typing"><span /><span /><span /></div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="ai-starters">
            {STARTERS.map((s) => (
              <button key={s} className="ai-starter-chip" onClick={() => sendStarter(s)}>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Message Cortex AI… (Enter to send, Shift+Enter for new line)"
            rows={3}
            disabled={loading}
          />
          <button type="submit" className="btn-primary ai-send-btn" disabled={loading || !input.trim()}>
            {loading ? "Thinking…" : "Send ↑"}
          </button>
        </form>
      </div>
    </div>
  );
};
