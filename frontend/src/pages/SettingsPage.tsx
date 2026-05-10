import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props { onLogout: () => void }

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

export const SettingsPage = ({ onLogout }: Props) => {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(true);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailUrl, setGmailUrl] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  const isElectron = !!(window as ElectronWindow).electron?.isElectron;

  const loadSpotify = async () => {
    setSpotifyLoading(true);
    try {
      const r = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      setSpotifyConnected(r.data?.data?.connected ?? false);
      if (!r.data?.data?.connected) {
        const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
        setSpotifyUrl(u.data?.data?.url ?? null);
      } else {
        setSpotifyUrl(null);
      }
    } catch (e) { console.error("[spotify] load failed:", e); }
    finally { setSpotifyLoading(false); }
  };

  const loadGmail = async () => {
    setGmailLoading(true);
    try {
      const r = await api.get<{ data?: { connected?: boolean } }>("/gmail/status");
      setGmailConnected(r.data?.data?.connected ?? false);
      if (!r.data?.data?.connected) {
        // Pass desktop=1 in Electron so the backend embeds it in the signed state JWT.
        // The callback reads it back from the verified state to decide whether to
        // redirect to cortex://oauth/google?connected=1 or the web frontend URL.
        const urlEndpoint = isElectron ? "/gmail/oauth/url?desktop=1" : "/gmail/oauth/url";
        const u = await api.get<{ data?: { url?: string } }>(urlEndpoint);
        const url = u.data?.data?.url ?? null;
        setGmailUrl(url);
      } else {
        setGmailUrl(null);
      }
    } catch (e) { console.error("[gmail] load failed:", e); }
    finally { setGmailLoading(false); }
  };

  useEffect(() => { void loadSpotify(); void loadGmail(); }, []);

  // Reload when Electron deep-link completes
  useEffect(() => {
    const handler = (e: Event) => {
      const provider = (e as CustomEvent<{ provider: string }>).detail?.provider;
      if (provider === "spotify") void loadSpotify();
      if (provider === "google") void loadGmail();
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, []);

  const openOAuth = (url: string | null) => {
    if (!url) return;
    if (isElectron) {
      void (window as ElectronWindow).electron!.openExternal!(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const disconnectSpotify = async () => {
    try { await api.post("/spotify/disconnect"); await loadSpotify(); } catch { /* ignore */ }
  };

  const disconnectGmail = async () => {
    try { await api.post("/gmail/disconnect"); await loadGmail(); } catch { /* ignore */ }
  };

  return (
    <div className="page">
      <div className="page-titlebar">
        <h1 className="page-title">Settings</h1>
      </div>

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
                    {spotifyLoading ? "Checking…" : spotifyConnected ? "Connected — now-playing & playback controls active" : "Connect to show what's playing and control playback"}
                  </p>
                </div>
              </div>
              {!spotifyLoading && (
                spotifyConnected
                  ? <button className="btn-ghost btn-sm" onClick={() => void disconnectSpotify()}>Disconnect</button>
                  : <button className="btn-primary btn-sm" onClick={() => openOAuth(spotifyUrl)}>Connect</button>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">✉️</div>
                <div>
                  <p className="settings-item-name">Gmail</p>
                  <p className="settings-item-desc">
                    {gmailLoading ? "Checking…" : gmailConnected ? "Connected — inbox visible in Gmail tab" : "Connect to read and manage your inbox"}
                  </p>
                </div>
              </div>
              {!gmailLoading && (
                gmailConnected
                  ? <button className="btn-ghost btn-sm" onClick={() => void disconnectGmail()}>Disconnect</button>
                  : <button className="btn-primary btn-sm" onClick={() => openOAuth(gmailUrl)}>Connect</button>
              )}
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
              <button className="btn-danger btn-sm" onClick={onLogout}>Sign out</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
