import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message { id: string; role: "user" | "assistant"; content: string }

export const AIPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, or questions." }
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/ai/chat", { message: msg });
      const reply: string = res.data?.data?.reply ?? res.data?.reply ?? "…";
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: "Could not reach the server." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page ai-page">
      <div className="page-titlebar">
        <h1 className="page-title">AI Assistant</h1>
        <button
          className="btn-ghost"
          onClick={() => setMessages([{ id: "init", role: "assistant", content: "New conversation started." }])}
        >
          Clear chat
        </button>
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
              <div className="ai-msg-body ai-typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="ai-composer" onSubmit={send}>
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
