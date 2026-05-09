import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export const AIPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "Hi, I'm Cortex AI. Ask me anything — tasks, ideas, questions."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/ai/chat", { message: msg });
      const reply: string = res.data?.data?.reply ?? res.data?.reply ?? "…";
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, I couldn't reach the server." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="page ai-page">
      <header className="page-header">
        <h1 className="page-title">AI</h1>
        <button
          className="header-action-btn"
          onClick={() =>
            setMessages([{ id: "init", role: "assistant", content: "Hi, I'm Cortex AI. Ask me anything." }])
          }
        >
          Clear
        </button>
      </header>

      <div className="ai-messages">
        {messages.map((m) => (
          <div key={m.id} className={`ai-bubble ai-bubble--${m.role}`}>
            <p className="ai-bubble-text">{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="ai-bubble ai-bubble--assistant">
            <p className="ai-bubble-text ai-typing">
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="ai-input-bar" onSubmit={send}>
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Cortex AI…"
          rows={1}
          disabled={loading}
        />
        <button type="submit" className="ai-send-btn" disabled={loading || !input.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
};
