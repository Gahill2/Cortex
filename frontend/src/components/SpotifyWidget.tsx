import { api } from "../api/client";

interface NowPlaying {
  isPlaying: boolean;
  track?: {
    name: string;
    artists: string;
    albumArt?: string;
    progressMs?: number;
    durationMs?: number;
  };
  device?: { name: string; volumePercent: number };
}

interface Props {
  connected: boolean;
  nowPlaying: NowPlaying | null;
  onRefresh: () => void;
}

const playbackAction = async (action: string) => {
  try { await api.post(`/spotify/playback/${action}`); } catch { /* best-effort */ }
};

export const SpotifyWidget = ({ connected, nowPlaying, onRefresh }: Props) => {
  if (!connected) {
    return (
      <div className="spotify-widget spotify-widget--disconnected">
        <div className="spotify-widget-icon">♫</div>
        <div>
          <p className="spotify-widget-title">Spotify</p>
          <p className="spotify-widget-sub">Not connected</p>
        </div>
        <a className="spotify-connect-btn" href={`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/spotify/oauth/url`}>
          Connect
        </a>
      </div>
    );
  }

  if (!nowPlaying || !nowPlaying.isPlaying) {
    return (
      <div className="spotify-widget spotify-widget--idle">
        <div className="spotify-widget-icon">♫</div>
        <div className="spotify-widget-info">
          <p className="spotify-widget-title">Spotify</p>
          <p className="spotify-widget-sub">Nothing playing</p>
        </div>
        <button className="spotify-refresh-btn" onClick={onRefresh} aria-label="Refresh">↻</button>
      </div>
    );
  }

  const { track, device } = nowPlaying;

  return (
    <div className="spotify-widget spotify-widget--playing">
      <div className="spotify-art">
        {track?.albumArt ? (
          <img src={track.albumArt} alt="Album art" className="spotify-art-img" />
        ) : (
          <div className="spotify-art-placeholder">♫</div>
        )}
      </div>
      <div className="spotify-widget-body">
        <p className="spotify-track-name">{track?.name ?? "—"}</p>
        <p className="spotify-artist">{track?.artists ?? "—"}</p>
        {device && <p className="spotify-device">▸ {device.name}</p>}
        <div className="spotify-controls">
          <button onClick={() => void playbackAction("previous")} aria-label="Previous">⏮</button>
          <button
            className="spotify-playpause"
            onClick={() => void playbackAction(nowPlaying.isPlaying ? "pause" : "play")}
            aria-label={nowPlaying.isPlaying ? "Pause" : "Play"}
          >
            {nowPlaying.isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={() => void playbackAction("next")} aria-label="Next">⏭</button>
          <button className="spotify-refresh-small" onClick={onRefresh} aria-label="Refresh">↻</button>
        </div>
      </div>
    </div>
  );
};
