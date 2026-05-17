import { useEffect, useRef } from "react";
import { api } from "../api/client";

type Service = "spotify" | "gmail";

const ORDER: Service[] = ["spotify", "gmail"];

const URL_PATH: Record<Service, string> = {
  spotify: "/spotify/oauth/url",
  gmail: "/mail/oauth/url",
};

type IntegrationStatusResponse = {
  data?: {
    items?: Array<{ id: string; configured: boolean; connected: boolean }>;
  };
};

type OAuthUrlResponse = {
  data?: { url?: string };
};

/**
 * When API keys are in .env but the user has not completed OAuth yet,
 * send them through the provider consent screen once per service per session.
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

        for (const service of ORDER) {
          const item = items.find((i) => i.id === service);
          if (!item?.configured || item.connected) continue;

          const sessionKey = `cortex_oauth_auto_${service}`;
          if (sessionStorage.getItem(sessionKey)) continue;

          const urlRes = await api.get<OAuthUrlResponse>(URL_PATH[service]);
          const url = urlRes.data?.data?.url;
          if (!url) continue;

          sessionStorage.setItem(sessionKey, "1");
          window.location.href = url;
          return;
        }
      } catch {
        /* user can connect manually from Settings */
      }
    })();
  }, [enabled]);

  return null;
};
