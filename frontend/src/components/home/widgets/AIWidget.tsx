import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp, X } from "lucide-react";
import { BrandIcon, type BrandId } from "../../brand";
import { api } from "../../../api/client";
import type { Tab } from "../../../App";
import {
  type ChatAIProviderId,
  pickDefaultProvider,
  readStoredAIProvider,
} from "../../../lib/aiProvider";

export function AIWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ChatAIProviderId>(() => readStoredAIProvider() ?? "kimi");

  const loadProviderDefault = async () => {
    try {
      const r = await api.get("/ai/status");
      const data = r.data?.data ?? r.data;
      const providers = data?.providers ?? [];
      const def = data?.defaultProvider ?? null;
      if (providers.length) {
        setProvider((prev) =>
          providers.find((p: { id: string; available: boolean }) => p.id === prev && p.available)
            ? prev
            : pickDefaultProvider(providers, def)
        );
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadProviderDefault();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const msg = prompt.trim();
    if (!msg) return;
    setLoading(true);
    setReply(null);
    try {
      const r = await api.post("/ai/chat", { message: msg, provider });
      setReply(r.data?.data?.reply ?? r.data?.reply ?? "Done.");
      setPrompt("");
    } catch {
      setReply("Unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const aiBrand: BrandId =
    provider === "openai" ? "openai" : provider === "kimi" ? "cortex" : provider === "ollama" ? "cortex" : "anthropic";

  return (
    <div className="widget widget--ai">
      <div className="widget-label widget-label--brand">
        <BrandIcon brand={aiBrand} size={18} />
        <span>AI Assistant</span>
      </div>
      {reply && (
        <div className="widget-ai-bubble">
          {reply}
          <button type="button" className="widget-ai-bubble-close" onClick={() => setReply(null)} aria-label="Dismiss">
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      )}
      {!reply && (
        <p className="widget-ai-idle" style={{ color: "var(--text-3)", margin: "4px 0 8px" }}>
          Ask anything…
        </p>
      )}
      <form className="widget-ai-form" onSubmit={send} onClick={(e) => e.stopPropagation()}>
        <div className="widget-ai-pill">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Quick question…"
            disabled={loading}
          />
          <button type="submit" className="widget-ai-pill-btn" disabled={loading || !prompt.trim()} aria-label="Send">
            <ArrowUp size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </form>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="widget-ai-open-link widget-ai-open-link--icon" onClick={() => onNavigate("ai")}>
          <span>Open full chat</span>
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

