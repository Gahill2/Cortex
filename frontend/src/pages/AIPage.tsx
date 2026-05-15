import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message { id: string; role: "user" | "assistant"; content: string }

export const AIPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, or questions." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberToMemory, setRememberToMemory] = useState(false);
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}`);
  const [lastMemoryHits, setLastMemoryHits] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", {
        message: msg,
        conversationId,
        rememberToMemory
      });
      const data = res.data?.data;
      const reply: string = data?.reply ?? res.data?.reply ?? "…";
      setLastMemoryHits(data?.memory?.contextHits ?? 0);
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: `e-${Date.now()}`, role: "assistant", content: "Could not reach the server." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ id: "init", role: "assistant", content: "New conversation started." }]);
    setConversationId(`conv_${Date.now()}`);
    setLastMemoryHits(0);
  };

  return (
    <div className="page ai-page">
      <div className="page-titlebar">
        <h1 className="page-title">AI Assistant</h1>
        <div className="page-actions">
          {lastMemoryHits > 0 && (
            <span className="badge">Memory context: {lastMemoryHits}</span>
          )}
          <label className="ai-remember-toggle">
            <input
              type="checkbox"
              checked={rememberToMemory}
              onChange={(e) => setRememberToMemory(e.target.checked)}
            />
            Remember this chat
          </label>
          <button type="button" className="btn-ghost" onClick={clearChat}>
            Clear chat
          </button>
        </div>
      </div>

      <div className="ai-layout">
        <div className="ai-messages">
          {messages.map((m) => (
            <div key={m.id} className={`ai-msg ai-msg--${m.role}`}>
              <div className="ai-msg-label">{m.role === "user" ? "You" : "Cortex AI"}</div>
              <div className="ai-msg-body">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="ai-msg ai-msg--assistant">
              <div className="ai-msg-label">Cortex AI</div>
              <div className="ai-msg-body ai-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="ai-composer" onSubmit={(e) => void send(e)}>
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