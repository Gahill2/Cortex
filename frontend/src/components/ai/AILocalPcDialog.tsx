import { useEffect } from "react";
import { Monitor, Cloud, RefreshCw } from "lucide-react";
import type { AIStatusPayload } from "../../lib/aiStatus";
import {
  type ChatAIProviderId,
  CHAT_AI_PROVIDER_LABELS,
  pickDefaultProvider,
  writeStoredAIProvider,
} from "../../lib/aiProvider";

type Props = {
  open: boolean;
  status: AIStatusPayload | null;
  onClose: () => void;
  onUseCloud: (provider: ChatAIProviderId) => void;
  onRetry: () => void;
  retrying?: boolean;
};

export function AILocalPcDialog({
  open,
  status,
  onClose,
  onUseCloud,
  onRetry,
  retrying,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pcName = status?.ollamaPcName ?? "Local PC";
  const host = status?.ollamaHost ?? "unknown";
  const cloud = pickDefaultProvider(status?.providers ?? [], status?.defaultProvider ?? null);

  return (
    <div className="ai-pc-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ai-pc-dialog"
        role="dialog"
        aria-labelledby="ai-pc-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ai-pc-dialog__icon" aria-hidden>
          <Monitor size={28} />
        </div>
        <h2 id="ai-pc-dialog-title" className="ai-pc-dialog__title">
          {pcName} is offline
        </h2>
        <p className="ai-pc-dialog__body">
          Cortex can&apos;t reach Ollama at <code>{host}</code>. Turn on your PC, start Ollama
          (and Tailscale if you use it), or continue with a cloud model.
        </p>
        <div className="ai-pc-dialog__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => onUseCloud(cloud)}
          >
            <Cloud size={16} aria-hidden />
            Use {CHAT_AI_PROVIDER_LABELS[cloud]} (cloud)
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw size={16} aria-hidden className={retrying ? "ai-pc-dialog__spin" : ""} />
            {retrying ? "Checking…" : "Check again"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Switch to best available cloud provider and persist choice. */
export function applyCloudFallback(
  status: AIStatusPayload | null,
  setProvider: (id: ChatAIProviderId) => void,
): ChatAIProviderId {
  const id = pickDefaultProvider(status?.providers ?? [], status?.defaultProvider ?? null);
  if (id !== "ollama") writeStoredAIProvider(id);
  setProvider(id);
  return id;
}
