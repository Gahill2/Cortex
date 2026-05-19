import { useEffect, useRef } from "react";
import { api } from "../api/client";

type IntegrationStatusResponse = {
  data?: {
    items?: Array<{ id: string; configured: boolean; connected: boolean }>;
  };
};

/**
 * Optional one-time Gmail OAuth nudge when configured but not linked.
 * Spotify is intentionally excluded — auto-redirecting each session felt like
 * repeated login even when tokens were stored server-side.
 */
export const OAuthBootstrap = ({ enabled }: { enabled: boolean }) => {
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;

    void (async () => {
      try {
        const r = await api.get<IntegrationStatusResponse>("/integrations/status");
        const items = r.data?.data?.items ?? [];
        const gmail = items.find((i) => i.id === "gmail");
        if (!gmail?.configured || gmail.connected) return;

        const sessionKey = "cortex_oauth_auto_gmail";
        if (sessionStorage.getItem(sessionKey)) return;

        const urlRes = await api.get<{ data?: { url?: string } }>("/mail/oauth/url");
        const url = urlRes.data?.data?.url;
        if (!url) return;

        sessionStorage.setItem(sessionKey, "1");
        window.location.href = url;
      } catch {
        /* user can connect manually from Settings or Mail */
      }
    })();
  }, [enabled]);

  return null;
};
