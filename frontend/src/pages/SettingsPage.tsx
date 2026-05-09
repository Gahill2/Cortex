import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props { onLogout: () => void }

export const SettingsPage = ({ onLogout }: Props) => {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [oauthUrl,  setOauthUrl]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { void loadSpotify(); }, []);

  const loadSpotify = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      setSpotifyConnected(r.data?.data?.connected ?? false);
      if (!r.data?.data?.connected) {
        const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
        setOauthUrl(u.data?.data?.url ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const disconnect = async () => {
    try { await api.post("/spotify/disconnect"); await loadSpotify(); } catch { /* ignore */ }
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
                    {loading ? "Checking…" : spotifyConnected ? "Connected — now-playing & playback controls active" : "Connect to show what's playing and control playback"}
                  </p>
                </div>
              </div>
              {!loading && (
                spotifyConnected
                  ? <button className="btn-ghost btn-sm" onClick={() => void disconnect()}>Disconnect</button>
                  : <a className="btn-primary btn-sm" href={oauthUrl ?? "#"}>Connect</a>
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
