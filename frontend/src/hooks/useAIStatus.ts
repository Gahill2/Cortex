import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AIStatusPayload } from "../lib/aiStatus";

export function useAIStatus(pollMs = 0) {
  const [status, setStatus] = useState<AIStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/ai/status");
      const data = (res.data?.data ?? res.data) as AIStatusPayload;
      setStatus(data);
      setError(null);
    } catch {
      setError("Could not load AI provider status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return { status, loading, error, refresh };
}
