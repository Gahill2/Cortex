import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  onLogout: () => void;
}

export const SettingsPage = ({ onLogout }: Props) => {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadSpotifyStatus();
  }, []);

  const loadSpotifyStatus = async () => {
    setSpotifyLoading(true);
    try {
      const res = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      setSpotifyConnected(res.data?.data?.connected ?? false);
      if (!res.data?.data?.connected) {
        try {
          const urlRes = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
          setOauthUrl(urlRes.data?.data?.url ?? null);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setSpotifyLoading(false); }
  };

  const disconnectSpotify = async () => {
    try {
      await api.post("/spotify/disconnect");
      setSpotifyConnected(false);
      await loadSpotifyStatus();
    } catch { /* ignore */ }
  };

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="settings-section">
        <h2 className="settings-section-title">Connections</h2>

        <div className="settings-row">
          <div className="settings-row-icon settings-row-icon--spotify">♫</div>
          <div className="settings-row-body">
            <p className="settings-row-label">Spotify</p>
            <p className="settings-row-sub">
              {spotifyLoading ? "Checking…" : spotifyConnected ? "Connected" : "Not connected"}
            </p>
          </div>
          {!spotifyLoading && (
            spotifyConnected ? (
              <button className="settings-disconnect-btn" onClick={() => void disconnectSpotify()}>
                Disconnect
              </button>
            ) : (
              <a
                className="settings-connect-btn"
                href={oauthUrl ?? "#"}
                rel="noopener noreferrer"
              >
                Connect
              </a>
            )
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-row">
          <div className="settings-row-icon">⚙</div>
          <div className="settings-row-body">
            <p className="settings-row-label">Session</p>
            <p className="settings-row-sub">Signed in via email OTP</p>
          </div>
        </div>
      </section>

      <button className="settings-logout-btn" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
};
