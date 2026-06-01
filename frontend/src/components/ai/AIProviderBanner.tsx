import { Sparkles } from "lucide-react";
import {
  countAvailableProviders,
  hasLocalFallback,
  primaryCloudProvider,
  type AIStatusPayload,
} from "../../lib/aiStatus";
import { CHAT_AI_PROVIDER_LABELS } from "../../lib/aiProvider";

type Props = {
  status: AIStatusPayload | null;
  loading?: boolean;
  compact?: boolean;
  onNavigateAI?: () => void;
};

export function AIProviderBanner({ status, loading, compact, onNavigateAI }: Props) {
  if (loading && !status) return null;

  const available = countAvailableProviders(status);
  const cloud = primaryCloudProvider(status);
  const ollama = hasLocalFallback(status);
  const hints = status?.hints ?? [];

  if (available === 0) {
    return (
      <div className="ai-provider-banner ai-provider-banner--error" role="status">
        <Sparkles size={16} aria-hidden />
        <div className="ai-provider-banner__body">
          <strong>No AI providers configured</strong>
          <p>
            Add KIMI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to api.env — or run{" "}
            <code>ollama serve</code> on the host.
          </p>
        </div>
        {onNavigateAI ? (
          <button type="button" className="btn-ghost btn-sm" onClick={onNavigateAI}>
            Open AI
          </button>
        ) : null}
      </div>
    );
  }

  if (compact && available > 0 && hints.length === 0) return null;

  const tone = hints.length > 0 && !ollama ? "warn" : "info";

  return (
    <div className={`ai-provider-banner ai-provider-banner--${tone}`} role="status">
      <Sparkles size={16} aria-hidden />
      <div className="ai-provider-banner__body">
        <strong>
          {cloud
            ? `${CHAT_AI_PROVIDER_LABELS[cloud.id]} · ${cloud.model}`
            : ollama
              ? `Ollama · ${status?.ollamaModel ?? "local"}`
              : "AI ready"}
          {ollama && cloud ? " · Ollama fallback" : ""}
        </strong>
        {!compact && hints.length > 0 ? (
          <p>{hints[0]}</p>
        ) : !compact ? (
          <p>
            {available} provider{available === 1 ? "" : "s"} available
            {cloud ? ` — cloud default ${CHAT_AI_PROVIDER_LABELS[cloud.id]}` : ""}
            {ollama ? ", local Ollama fallback" : ""}.
          </p>
        ) : hints[0] ? (
          <p>{hints[0]}</p>
        ) : null}
      </div>
      {onNavigateAI ? (
        <button type="button" className="btn-ghost btn-sm" onClick={onNavigateAI}>
          Models
        </button>
      ) : null}
    </div>
  );
}
