import { api } from "../api/client";
import type { SpotifyNowPlaying } from "../lib/spotify";

type NowPlaying = SpotifyNowPlaying;

interface Props {
  connected: boolean;
  nowPlaying: NowPlaying | null;
  onRefresh: () => void;
}

const control = async (action: string) => {
  try { await api.post(`/spotify/playback/${action}`); } catch { /* best-effort */ }
};

export const SpotifyWidget = ({ connected, nowPlaying, onRefresh }: Props) => {
  if (!connected) {
    return (
      <div className="widget-card spotify-widget">
        <div className="widget-header">
          <h2 className="widget-title">♫ Spotify</h2>
          <a
            className="btn-primary btn-sm"
            href={`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/spotify/oauth/url`}
          >
            Connect
          </a>
        </div>
        <p className="widget-empty">Not connected</p>
      </div>
    );
  }

  if (!nowPlaying?.track) {
    return (
      <div className="widget-card spotify-widget">
        <div className="widget-header">
          <h2 className="widget-title">♫ Spotify</h2>
          <button className="btn-ghost btn-sm" onClick={onRefresh}>Refresh</button>
        </div>
        <p className="widget-empty">Nothing playing — start Spotify, then refresh</p>
      </div>
    );
  }

  const { track, device } = nowPlaying;

  return (
    <div className="widget-card spotify-widget spotify-widget--active">
      <div className="widget-header">
        <h2 className="widget-title">♫ Now Playing</h2>
        <button className="btn-ghost btn-sm" onClick={onRefresh}>↻</button>
      </div>
      <div className="spotify-body">
        <div className="spotify-art">
          {track?.albumArt
            ? <img src={track.albumArt} alt="Album art" />
            : <div className="spotify-art-fallback">♫</div>
          }
        </div>
        <div className="spotify-info">
          <p className="spotify-track">{track?.name}</p>
          <p className="spotify-artist">{track?.artists}</p>
          {device && <p className="spotify-device">▸ {device.name}</p>}
        </div>
      </div>
      <div className="spotify-controls">
        <button onClick={() => void control("previous")} title="Previous">⏮</button>
        <button className="spotify-playpause" onClick={() => void control(nowPlaying.isPlaying ? "pause" : "play")}>
          {nowPlaying.isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={() => void control("next")} title="Next">⏭</button>
      </div>
    </div>
  );
};
