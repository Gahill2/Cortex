import { useEffect, useState } from "react";
import { Speaker } from "lucide-react";
import { BrandIcon } from "../../brand";
import { api } from "../../../api/client";
import type { Tab } from "../../../App";
import type { NowPlaying } from "./types";

export function SpotifyWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [np, setNp] = useState<NowPlaying | null>(null);

  const load = async () => {
    try {
      const s = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      const conn = s.data?.data?.connected ?? false;
      setConnected(conn);
      if (conn) {
        const r = await api.get("/spotify/now-playing");
        setNp(r.data?.data ?? r.data ?? null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ctrl = async (action: string) => {
    try {
      await api.post(`/spotify/playback/${action}`);
      setTimeout(load, 700);
    } catch {
      /* ignore */
    }
  };

  const albumArt = np?.track?.albumArt;

  return (
    <div
      className={`widget widget--spotify spotify-spicetify ${connected && np?.playing ? "widget--spotify-active" : ""}`}
    >
      {albumArt ? (
        <div
          className="spotify-spicetify__backdrop"
          style={{ backgroundImage: `url(${albumArt})` }}
          aria-hidden
        />
      ) : null}
      <div className="widget-label widget-label--brand">
        <BrandIcon brand="spotify" size={18} title="Spotify" />
        <span>Spotify</span>
      </div>
      {loading ? (
        <p className="widget-empty"><span className="inline-loading-spinner inline-loading-spinner--sm" aria-hidden="true" /> Checking…</p>
      ) : !connected ? (
        <div className="spotify-cta-card">
          <BrandIcon brand="spotify" size={32} className="spotify-cta-icon" />
          <p className="spotify-cta-text">Connect Spotify to see what&apos;s playing</p>
          <button type="button" className="widget-cta-btn" onClick={() => onNavigate("settings")}>
            Connect in Settings →
          </button>
        </div>
      ) : !np?.playing ? (
        <p className="widget-empty">Nothing playing — open Spotify to start</p>
      ) : (
        <>
          <div className="spotify-widget-body">
            <div
              className={`spotify-widget-art ${np.playing ? "spotify-art-playing" : ""}`}
              style={{ borderRadius: 6, overflow: "hidden", flexShrink: 0 }}
            >
              {np.track?.albumArt ? (
                <img className="spotify-art-img" src={np.track.albumArt} alt="" />
              ) : (
                <div className="spotify-art-fallback-lg">♫</div>
              )}
            </div>
            <div className="spotify-widget-info" style={{ minWidth: 0, flex: 1 }}>
              <p className="spotify-track-name">{np.track?.name}</p>
              <p className="spotify-artist-name">{np.track?.artists?.join(", ")}</p>
              {np.device && (
                <p className="spotify-widget-device" style={{ color: "var(--text-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <Speaker size={11} strokeWidth={2} aria-hidden />
                  <span>{np.device.name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="spotify-controls-row">
            <button type="button" className="spotify-ctrl-btn" onClick={() => void ctrl("previous")}>
              ⏮
            </button>
            <button
              type="button"
              className="spotify-ctrl-btn spotify-ctrl-btn--pp"
              onClick={() => void ctrl(np.playing ? "pause" : "play")}
            >
              {np.playing ? "⏸" : "▶"}
            </button>
            <button type="button" className="spotify-ctrl-btn" onClick={() => void ctrl("next")}>
              ⏭
            </button>
            <button type="button" className="spotify-ctrl-btn" onClick={() => void load()}>
              ↻
            </button>
          </div>
          <div className="spotify-progress-bar-track">
            <div className="spotify-progress-bar-fill" />
          </div>
        </>
      )}
      {connected && (
        <button type="button" className="widget-cta-link" onClick={() => onNavigate("spotify")}>
          AI playlists →
        </button>
      )}
    </div>
  );
}
