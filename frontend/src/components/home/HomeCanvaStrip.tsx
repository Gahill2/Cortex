import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { Tab } from "../../App";
import { api } from "../../api/client";
import { GlassPanel } from "../ui/GlassPanel";

const SCROLL_KEY = "cortex_settings_scroll_to";
export const SETTINGS_INTEGRATIONS_ANCHOR = "settings-integrations";

type CanvaStatus = {
  apps_sdk: { app_id_configured: boolean; app_origin_configured: boolean; hmr_enabled: boolean };
  connect: {
    client_id_configured: boolean;
    client_secret_configured: boolean;
    redirect_uri_configured: boolean;
    oauth_exchange_ready: boolean;
    connected: boolean;
  };
  redirect_uri_to_register: string | null;
};

type Props = { onNavigate: (t: Tab) => void };

function statusChip(
  loading: boolean,
  status: CanvaStatus | null,
  unauthorized: boolean,
  networkError: boolean
): { tone: "connected" | "disconnected"; text: string } {
  if (unauthorized) return { tone: "disconnected", text: "Session expired" };
  if (networkError) return { tone: "disconnected", text: "API unreachable" };
  if (loading) return { tone: "disconnected", text: "Checking…" };
  const c = status?.connect;
  if (c?.connected) return { tone: "connected", text: "Connect linked" };
  if (c?.oauth_exchange_ready) return { tone: "disconnected", text: "Ready to connect" };
  if (status?.apps_sdk.app_id_configured || status?.apps_sdk.app_origin_configured) {
    return { tone: "disconnected", text: "Apps SDK on API" };
  }
  const canvaAppId = (import.meta.env.VITE_CANVA_APP_ID as string | undefined)?.trim() ?? "";
  if (canvaAppId.length > 0) return { tone: "connected", text: "App ID in build" };
  return { tone: "disconnected", text: "Not configured" };
}

export function HomeCanvaStrip({ onNavigate }: Props) {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnauthorized(false);
    setNetworkError(false);
    try {
      const r = await api.get<{ data?: CanvaStatus }>("/canva/status");
      setStatus(r.data?.data ?? null);
    } catch (e) {
      setStatus(null);
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 401) setUnauthorized(true);
        else if (!e.response) setNetworkError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onOAuth = (ev: Event) => {
      const p = (ev as CustomEvent<{ provider?: string }>).detail?.provider;
      if (p === "canva") void load();
    };
    window.addEventListener("oauth-connected", onOAuth);
    return () => window.removeEventListener("oauth-connected", onOAuth);
  }, [load]);

  const chip = statusChip(loading, status, unauthorized, networkError);

  const openSettings = () => {
    sessionStorage.setItem(SCROLL_KEY, SETTINGS_INTEGRATIONS_ANCHOR);
    onNavigate("settings");
  };

  return (
    <div className="home-canva-strip mb-3 mb-lg-3">
      <GlassPanel as="section" className="home-canva-strip-panel" aria-label="Canva integration">
        <div className="home-canva-strip-inner">
          <div className="home-canva-strip-left">
            <span className="home-canva-strip-icon" aria-hidden>
              ◆
            </span>
            <div className="home-canva-strip-copy">
              <p className="home-canva-strip-title">Canva</p>
              <p className="home-canva-strip-sub">
                Connect status matches Settings. Link OAuth and server keys there.
              </p>
            </div>
          </div>
          <div className="home-canva-strip-right">
            <span className={`integration-status integration-status--${chip.tone}`} aria-live="polite">
              ● {chip.text}
            </span>
            <button type="button" className="btn-ghost btn-sm home-canva-strip-btn" onClick={openSettings}>
              Open in Settings
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
