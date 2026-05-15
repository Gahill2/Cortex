import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";
import { IntegrationsPanel, type IntegrationItem } from "../components/IntegrationsPanel";
import { ConnectOAuthButton } from "../components/ConnectOAuthButton";

interface Props { onLogout: () => void }

export const SettingsPage = ({ onLogout }: Props) => {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseSyncing, setFirebaseSyncing] = useState(false);
  const [firebaseMsg, setFirebaseMsg] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [billingStatus, setBillingStatus] = useState<string>("free");
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [memoryConfig, setMemoryConfig] = useState<{
    config: { agentmemoryProject: string; vaultPaths: string[] };
    sync: { firebaseConfigured: boolean; source: string; updatedAt: string | null };
  } | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [syncingMemory, setSyncingMemory] = useState(false);
  const [memoryMsg, setMemoryMsg] = useState<string | null>(null);
  const [electronMemory, setElectronMemory] = useState<{
    online: boolean;
    managed: boolean;
  } | null>(null);
  const isElectron = Boolean((window as { electron?: { isElectron?: boolean } }).electron?.isElectron);

  useEffect(() => {
    void loadSpotify();
    void loadIntegrations();
    void loadBilling();
    void loadMemoryConfig();
    if (isElectron) void loadElectronMemory();
  }, []);

  const loadMemoryConfig = async () => {
    setMemoryLoading(true);
    try {
      const r = await api.get<{ data?: typeof memoryConfig }>("/memory/config");
      setMemoryConfig(r.data?.data ?? null);
    } catch {
      setMemoryConfig(null);
    } finally {
      setMemoryLoading(false);
    }
  };

  const syncMemoryConfig = async () => {
    setSyncingMemory(true);
    setMemoryMsg(null);
    try {
      const r = await api.put<{ data?: typeof memoryConfig }>("/memory/config", {});
      setMemoryConfig(r.data?.data ?? null);
      setMemoryMsg(r.data?.data?.sync.firebaseConfigured ? "Memory config synced." : "Firebase not configured — local only.");
    } catch {
      setMemoryMsg("Sync failed.");
    } finally {
      setSyncingMemory(false);
    }
  };

  const loadElectronMemory = async () => {
    const bridge = (window as {
      electron?: { getMemoryStatus?: () => Promise<{ online: boolean; managed: boolean }> };
    }).electron;
    if (!bridge?.getMemoryStatus) return;
    try {
      setElectronMemory(await bridge.getMemoryStatus());
    } catch {
      setElectronMemory(null);
    }
  };

  const loadBilling = async () => {
    try {
      const r = await api.get<{ data?: { subscriptionStatus?: string; configured?: boolean } }>(
        "/billing/status"
      );
      setBillingStatus(r.data?.data?.subscriptionStatus ?? "free");
      setBillingConfigured(r.data?.data?.configured ?? false);
    } catch { /* ignore */ }
  };

  const startCheckout = async () => {
    setBillingBusy(true);
    try {
      const r = await api.post<{ data?: { url?: string } }>("/billing/checkout", {});
      const url = r.data?.data?.url;
      if (url) window.location.href = url;
    } catch { /* ignore */ }
    finally { setBillingBusy(false); }
  };

  const openPortal = async () => {
    setBillingBusy(true);
    try {
      const r = await api.post<{ data?: { url?: string } }>("/billing/portal", {});
      const url = r.data?.data?.url;
      if (url) window.location.href = url;
    } catch { /* ignore */ }
    finally { setBillingBusy(false); }
  };

  const loadIntegrations = async () => {
    try {
      const r = await api.get<{ data?: { items?: IntegrationItem[] } }>("/integrations/status");
      setIntegrations(r.data?.data?.items ?? []);
    } catch {
      setIntegrations([]);
    }
  };

  const loadSpotify = async () => {
    setLoading(true);
    const server = await getServerIntegrationConfig();
    setSpotifyConfigured(server.spotify);
    try {
      const r = await api.get<{ data?: { configured?: boolean; connected?: boolean } }>("/spotify/status");
      const data = r.data?.data;
      const connected = data?.connected ?? false;
      const configured = data?.configured ?? server.spotify;
      setSpotifyConnected(connected);
      setSpotifyConfigured(configured);
      if (!connected && configured) {
        try {
          const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
          setOauthUrl(u.data?.data?.url ?? null);
        } catch {
          setOauthUrl(null);
        }
      } else {
        setOauthUrl(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const disconnect = async () => {
    try { await api.post("/spotify/disconnect"); await loadSpotify(); } catch { /* ignore */ }
  };

  const pushEnvToFirestore = async () => {
    setFirebaseSyncing(true);
    setFirebaseMsg(null);
    try {
      await api.post("/firebase/env/push");
      setFirebaseMsg("Env pushed to Firestore.");
    } catch {
      setFirebaseMsg("Push failed — check Firebase config.");
    } finally {
      setFirebaseSyncing(false);
    }
  };

  const pullEnvFromFirestore = async () => {
    setFirebaseSyncing(true);
    setFirebaseMsg(null);
    try {
      await api.post("/firebase/env/pull");
      setFirebaseMsg("Env pulled from Firestore (restart API to apply).");
    } catch {
      setFirebaseMsg("Pull failed — check Firebase config.");
    } finally {
      setFirebaseSyncing(false);
    }
  };

  const gmail = integrations.find((i) => i.id === "gmail");
  const notion = integrations.find((i) => i.id === "notion");
  const firebase = integrations.find((i) => i.id === "firebase");
  const n8n = integrations.find((i) => i.id === "n8n");

  return (
    <div className="page">
      <div className="page-titlebar">
        <h1 className="page-title">Settings</h1>
      </div>

      <IntegrationsPanel compact={false} />

      <div className="settings-layout">
        <div className="settings-col">
          <section className="settings-section">
            <h2 className="settings-section-title">Integrations</h2>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--spotify">♫</div>
                <div>
                  <p className="settings-item-name">Spotify</p>
                  <p className="settings-item-desc">
                    {loading
                      ? "Checking…"
                      : spotifyConnected
                        ? "Connected"
                        : spotifyConfigured
                          ? "Keys in .env — link your Spotify account once"
                          : "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to backend .env"}
                  </p>
                </div>
              </div>
              {!loading && (
                spotifyConnected
                  ? <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnect()}>Disconnect</button>
                  : spotifyConfigured
                    ? <ConnectOAuthButton service="spotify" label="Connect" className="btn-primary btn-sm" />
                    : <span className="btn-ghost btn-sm settings-muted">Not configured</span>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--gmail">✉</div>
                <div>
                  <p className="settings-item-name">Gmail</p>
                  <p className="settings-item-desc">
                    {!gmail?.configured
                      ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
                      : gmail.connected
                        ? "Inbox linked"
                        : "API keys in .env — one-time Google sign-in required"}
                  </p>
                </div>
              </div>
              {gmail?.connected ? (
                <span className="integration-pill integration-pill--on">Live</span>
              ) : gmail?.configured ? (
                <ConnectOAuthButton service="gmail" label="Connect" className="btn-primary btn-sm" />
              ) : (
                <span className="integration-pill">Off</span>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--notion">N</div>
                <div>
                  <p className="settings-item-name">Notion</p>
                  <p className="settings-item-desc">
                    {notion?.connected
                      ? notion.detail ?? "Connected"
                      : notion?.configured
                        ? notion.detail ?? "Token set — connection failed"
                        : "Add NOTION_PERSONAL_TOKEN in env"}
                  </p>
                </div>
              </div>
              <span className={`integration-pill ${notion?.connected ? "integration-pill--on" : ""}`}>
                {notion?.connected ? "Live" : notion?.configured ? "Configured" : "Off"}
              </span>
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--firebase">⚡</div>
                <div>
                  <p className="settings-item-name">Firebase / Firestore</p>
                  <p className="settings-item-desc">{firebase?.detail ?? "Cross-device env sync"}</p>
                  {firebaseMsg && <p className="settings-item-hint">{firebaseMsg}</p>}
                </div>
              </div>
              <div className="settings-item-actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={firebaseSyncing || !firebase?.configured}
                  onClick={() => void pullEnvFromFirestore()}
                >
                  Pull env
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={firebaseSyncing || !firebase?.configured}
                  onClick={() => void pushEnvToFirestore()}
                >
                  Push env
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">⟳</div>
                <div>
                  <p className="settings-item-name">n8n</p>
                  <p className="settings-item-desc">{n8n?.detail ?? "Self-hosted automation"}</p>
                </div>
              </div>
              <span className={`integration-pill ${n8n?.configured ? "integration-pill--on" : ""}`}>
                {n8n?.configured ? "Webhook set" : "Off"}
              </span>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Memory</h2>
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">◎</div>
                <div>
                  <p className="settings-item-name">Cross-device config</p>
                  <p className="settings-item-desc">
                    {memoryLoading
                      ? "Loading…"
                      : memoryConfig?.sync.firebaseConfigured
                        ? `Source: ${memoryConfig.sync.source}${memoryConfig.sync.updatedAt ? ` · ${new Date(memoryConfig.sync.updatedAt).toLocaleString()}` : ""}`
                        : "Firebase not configured — using local .env"}
                  </p>
                  {memoryConfig && (
                    <p className="settings-item-hint">
                      {memoryConfig.config.agentmemoryProject || "default project"} ·{" "}
                      {memoryConfig.config.vaultPaths.length} vault path(s)
                    </p>
                  )}
                  {memoryMsg && <p className="settings-item-hint">{memoryMsg}</p>}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={memoryLoading || syncingMemory}
                onClick={() => void syncMemoryConfig()}
              >
                {syncingMemory ? "Syncing…" : "Sync across devices"}
              </button>
            </div>
            {isElectron && (
              <div className="settings-item">
                <div className="settings-item-left">
                  <div className="settings-item-icon">🖥</div>
                  <div>
                    <p className="settings-item-name">Desktop agentmemory</p>
                    <p className="settings-item-desc">
                      {electronMemory?.online ? "Online" : "Offline"}
                      {electronMemory?.managed ? " · managed by Cortex" : ""}
                    </p>
                  </div>
                </div>
                <div className="settings-item-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void (window as { electron?: { openMemoryViewer?: () => void } }).electron?.openMemoryViewer?.()}
                  >
                    Viewer
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void (window as { electron?: { copyMemoryMcpConfig?: () => void } }).electron?.copyMemoryMcpConfig?.()}
                  >
                    Copy MCP
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Billing</h2>
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">◆</div>
                <div>
                  <p className="settings-item-name">Cortex Pro</p>
                  <p className="settings-item-desc">
                    {billingConfigured
                      ? `Status: ${billingStatus}`
                      : "Add Stripe keys to enable subscriptions"}
                  </p>
                </div>
              </div>
              <div className="settings-item-actions">
                {billingStatus === "active" || billingStatus === "trialing" ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={billingBusy || !billingConfigured}
                    onClick={() => void openPortal()}
                  >
                    Manage
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={billingBusy || !billingConfigured}
                    onClick={() => void startCheckout()}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Session</h2>
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">👤</div>
                <div>
                  <p className="settings-item-name">Account</p>
                  <p className="settings-item-desc">Signed in via email OTP</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={() => {
                  void api.post("/auth/logout").catch(() => { /* ignore */ });
                  onLogout();
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
