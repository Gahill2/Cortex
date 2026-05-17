import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

// ── Types ────────────────────────────────────────────────────────────────────

interface NowPlayingTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  durationMs: number;
  progressMs: number;
}

interface NowPlayingData {
  configured: boolean;
  connected: boolean;
  playing: boolean;
  track?: NowPlayingTrack;
  device?: { name: string; type: string; volumePercent: number };
}

interface AIDJTrack {
  id: string;
  name: string;
  artists: string[];
  albumArt: string | null;
  uri: string;
  previewUrl: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Now Playing section ───────────────────────────────────────────────────────

function NowPlayingSection() {
  const [data, setData] = useState<NowPlayingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConnectUrl = async () => {
    try {
      const r = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
      setConnectUrl(r.data?.data?.url ?? null);
    } catch { /* ignore */ }
  };

  const load = async () => {
    try {
      const r = await api.get<{ data?: NowPlayingData }>("/spotify/now-playing");
      const d = r.data?.data ?? null;
      setData(d);
      setFetchError(false);
      // If not connected, prefetch the connect URL
      if (d && !d.connected) void loadConnectUrl();
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const openConnect = async () => {
    if (!connectUrl) return;
    const win = window as ElectronWindow;
    if (win.electron?.openExternal) {
      await win.electron.openExternal(connectUrl);
    } else {
      window.open(connectUrl, "_blank");
    }
  };

  // Re-connect after OAuth completes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ provider: string }>).detail;
      if (detail?.provider === "spotify") void load();
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const ctrl = async (action: string) => {
    try {
      await api.post(`/spotify/playback/${action}`);
      setTimeout(() => void load(), 700);
    } catch {
      /* best-effort */
    }
  };

  if (loading) {
    return (
      <section className="spotify-now-playing spotify-now-playing--loading">
        <p className="page-loading">Loading…</p>
      </section>
    );
  }

  if (fetchError) {
    return (
      <section className="spotify-now-playing">
        <div className="spotify-np-empty">
          <p className="spotify-np-empty-title">Could not reach server</p>
          <p className="spotify-np-empty-sub">Make sure the backend is running.</p>
          <button className="btn-ghost btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => { setFetchError(false); setLoading(true); void load(); }}>Retry</button>
        </div>
      </section>
    );
  }

  if (!data?.configured) {
    return (
      <section className="spotify-now-playing">
        <div className="spotify-np-empty">
          <p className="spotify-np-empty-title">Spotify not configured</p>
          <p className="spotify-np-empty-sub">Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your environment.</p>
        </div>
      </section>
    );
  }

  if (!data.connected) {
    return (
      <section className="spotify-now-playing">
        <div className="spotify-np-empty">
          <div className="spotify-np-icon">♫</div>
          <p className="spotify-np-empty-title">Connect your Spotify account</p>
          <p className="spotify-np-empty-sub">Link Spotify to see what's playing and control playback.</p>
          {connectUrl && (
            <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={() => void openConnect()}>
              Connect Spotify
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!data.playing || !data.track) {
    return (
      <section className="spotify-now-playing">
        <div className="spotify-np-empty">
          <div className="spotify-np-icon">♫</div>
          <p className="spotify-np-empty-title">Nothing playing</p>
          <p className="spotify-np-empty-sub">Open Spotify and start a track</p>
        </div>
        <button className="btn-ghost btn-sm spotify-np-refresh" onClick={() => void load()}>↻ Refresh</button>
      </section>
    );
  }

  const { track, device } = data;
  const progress = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  return (
    <section className="spotify-now-playing spotify-now-playing--active">
      <div className="spotify-np-inner">
        <div className="spotify-np-art">
          {track.albumArt
            ? <img src={track.albumArt} alt={track.album} />
            : <div className="spotify-np-art-fallback">♫</div>
          }
        </div>
        <div className="spotify-np-content">
          <div className="spotify-np-meta">
            <p className="spotify-np-track">{track.name}</p>
            <p className="spotify-np-artist">{track.artists.join(", ")}</p>
            <p className="spotify-np-album">{track.album}</p>
            {device && (
              <p className="spotify-np-device">
                ▸ {device.name}
                {device.volumePercent != null && <span className="spotify-np-vol"> · {device.volumePercent}%</span>}
              </p>
            )}
          </div>

          <div className="spotify-np-progress-row">
            <span className="spotify-np-time">{formatMs(track.progressMs)}</span>
            <div className="spotify-np-progress-bar">
              <div className="spotify-np-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="spotify-np-time">{formatMs(track.durationMs)}</span>
          </div>

          <div className="spotify-np-controls">
            <button className="spotify-ctrl-btn" onClick={() => void ctrl("previous")} title="Previous">⏮</button>
            <button
              className="spotify-ctrl-btn spotify-ctrl-btn--play"
              onClick={() => void ctrl(data.playing ? "pause" : "play")}
              title={data.playing ? "Pause" : "Play"}
            >
              {data.playing ? "⏸" : "▶"}
            </button>
            <button className="spotify-ctrl-btn" onClick={() => void ctrl("next")} title="Next">⏭</button>
            <button className="spotify-ctrl-btn spotify-ctrl-btn--refresh" onClick={() => void load()} title="Refresh">↻</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── AI DJ section ─────────────────────────────────────────────────────────────

function AIDJSection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AIDJTrack[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ name: string; url: string } | null>(null);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data?: { connected?: boolean } }>("/spotify/status")
      .then((r) => setConnected(r.data?.data?.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  const generate = async () => {
    const msg = prompt.trim();
    if (!msg) return;
    setLoading(true);
    setError(null);
    setTracks([]);
    setSaveResult(null);
    setSelected(new Set());
    try {
      const r = await api.post<{ data?: { tracks: AIDJTrack[]; playlistName: string } }>(
        "/spotify/ai/recommend",
        { prompt: msg }
      );
      const result = r.data?.data;
      if (!result) throw new Error("Empty response");
      setTracks(result.tracks);
      setPlaylistName(result.playlistName);
      setSelected(new Set(result.tracks.map((t) => t.uri)));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const msg = ax.response?.data?.error?.message ?? ax.message ?? "Request failed";
      setError(`Failed to generate playlist: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const queueTrack = async (uri: string) => {
    setQueueBusy(uri);
    try {
      await api.post("/spotify/playback/queue-track", { uri });
    } catch {
      /* best-effort */
    } finally {
      setQueueBusy(null);
    }
  };

  const toggleSelect = (uri: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const savePlaylist = async () => {
    const uris = tracks.filter((t) => selected.has(t.uri)).map((t) => t.uri);
    if (uris.length === 0) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const r = await api.post<{ data?: { playlistId: string; playlistUrl: string } }>(
        "/spotify/ai/create-playlist",
        { name: playlistName, trackUris: uris }
      );
      const result = r.data?.data;
      if (result) setSaveResult({ name: playlistName, url: result.playlistUrl });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(ax.response?.data?.error?.message ?? "Failed to save playlist. Check Spotify playlist permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (connected === null) {
    return (
      <section className="spotify-ai-dj">
        <p className="page-loading">Checking Spotify…</p>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="spotify-ai-dj">
        <div className="spotify-ai-empty">
          <div className="spotify-np-icon">♫</div>
          <p className="spotify-ai-empty-title">Connect Spotify in Settings first</p>
          <p className="spotify-ai-empty-sub">The AI DJ needs your Spotify account to search and queue tracks.</p>
        </div>
      </section>
    );
  }

  const selectedCount = selected.size;

  return (
    <section className="spotify-ai-dj">
      <div className="spotify-ai-header">
        <h2 className="spotify-ai-title">♫ AI DJ</h2>
        <p className="spotify-ai-subtitle">Describe a mood or genre — the AI will find real tracks for you.</p>
      </div>

      <form
        className="spotify-ai-form"
        onSubmit={(e) => { e.preventDefault(); void generate(); }}
      >
        <input
          className="spotify-ai-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What do you want to listen to?"
          disabled={loading}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !prompt.trim()}
        >
          {loading ? "Finding tracks…" : "Generate Playlist"}
        </button>
      </form>

      {error && <p className="spotify-ai-error">{error}</p>}

      {loading && (
        <div className="spotify-ai-loading">
          <div className="spotify-ai-loading-dots">
            <span />
            <span />
            <span />
          </div>
          <p>Asking AI for recommendations and searching Spotify…</p>
        </div>
      )}

      {tracks.length > 0 && !loading && (
        <>
          <div className="spotify-ai-results-header">
            <div>
              <p className="spotify-ai-playlist-name">{playlistName}</p>
              <p className="spotify-ai-track-count">{tracks.length} tracks found</p>
            </div>
            <div className="spotify-ai-results-actions">
              <button
                className="btn-ghost btn-sm"
                onClick={() => setSelected(new Set(tracks.map((t) => t.uri)))}
              >
                Select all
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                Deselect all
              </button>
            </div>
          </div>

          <div className="spotify-ai-tracklist">
            {tracks.map((track) => (
              <div
                key={track.uri}
                className={`spotify-ai-track ${selected.has(track.uri) ? "spotify-ai-track--selected" : ""}`}
              >
                <button
                  className="spotify-ai-track-check"
                  onClick={() => toggleSelect(track.uri)}
                  title={selected.has(track.uri) ? "Remove from selection" : "Add to selection"}
                >
                  {selected.has(track.uri) ? "●" : "○"}
                </button>
                <div className="spotify-ai-track-art">
                  {track.albumArt
                    ? <img src={track.albumArt} alt="" />
                    : <div className="spotify-ai-art-fallback">♫</div>
                  }
                </div>
                <div className="spotify-ai-track-info">
                  <p className="spotify-ai-track-name">{track.name}</p>
                  <p className="spotify-ai-track-artist">{track.artists.join(", ")}</p>
                </div>
                <div className="spotify-ai-track-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => void queueTrack(track.uri)}
                    disabled={queueBusy === track.uri}
                    title="Add to queue"
                  >
                    {queueBusy === track.uri ? "…" : "▶ Play now"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="spotify-ai-save-row">
            {saveResult ? (
              <div className="spotify-ai-save-success">
                <span>✓ Playlist "<strong>{saveResult.name}</strong>" saved to Spotify!</span>
                <a
                  className="btn-ghost btn-sm"
                  href={saveResult.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open →
                </a>
              </div>
            ) : (
              <>
                <div className="spotify-ai-playlist-name-field">
                  <label className="spotify-ai-label">Playlist name</label>
                  <input
                    className="spotify-ai-input spotify-ai-input--sm"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={() => void savePlaylist()}
                  disabled={saving || selectedCount === 0 || !playlistName.trim()}
                >
                  {saving ? "Saving…" : `Save ${selectedCount} track${selectedCount !== 1 ? "s" : ""} as playlist`}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ── Queue section ────────────────────────────────────────────────────────────

interface QueueTrack {
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  durationMs: number;
  uri: string;
}

function QueueSection() {
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await api.get<{ data?: { queue: QueueTrack[] } }>("/spotify/queue");
      setQueue(r.data?.data?.queue ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  if (loading) return <section className="spotify-section"><p className="page-loading">Loading queue…</p></section>;
  if (error) return (
    <section className="spotify-section">
      <div className="spotify-section-header">
        <h2 className="spotify-section-title">Up Next</h2>
        <button className="btn-ghost btn-sm" onClick={() => void loadQueue()}>Retry</button>
      </div>
      <p className="spotify-empty">Could not load queue — make sure Spotify is playing.</p>
    </section>
  );

  const visible = expanded ? queue : queue.slice(0, 5);

  return (
    <section className="spotify-section">
      <div className="spotify-section-header">
        <h2 className="spotify-section-title">Up Next ({queue.length})</h2>
        <button className="btn-ghost btn-sm" onClick={() => void loadQueue()}>↻ Refresh</button>
      </div>
      {queue.length === 0 ? (
        <p className="spotify-empty">Queue is empty — play something to see upcoming tracks.</p>
      ) : (
        <>
          <div className="spotify-queue-list">
            {visible.map((t, i) => (
              <div key={`${t.uri}-${i}`} className="spotify-queue-item">
                <span className="spotify-queue-num">{i + 1}</span>
                {t.albumArt && <img src={t.albumArt} alt="" className="spotify-queue-art" />}
                <div className="spotify-queue-info">
                  <span className="spotify-queue-name">{t.name}</span>
                  <span className="spotify-queue-artist">{t.artists.join(", ")}</span>
                </div>
                <span className="spotify-queue-dur">{formatMs(t.durationMs)}</span>
              </div>
            ))}
          </div>
          {queue.length > 5 && (
            <button
              className="btn-ghost btn-sm spotify-queue-toggle"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show all ${queue.length} tracks`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const SpotifyPage = () => {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<{ data?: { connected?: boolean } }>("/spotify/status")
      .then((r) => setConnected(r.data?.data?.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ provider: string }>).detail?.provider === "spotify") {
        setConnected(true);
      }
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, []);

  const disconnect = async () => {
    try { await api.post("/spotify/disconnect"); setConnected(false); } catch { /* ignore */ }
  };

  return (
    <div className="page spotify-page">
      <div className="page-titlebar">
        <h1 className="page-title">♫ Spotify</h1>
        {connected && (
          <button className="btn-ghost btn-sm" onClick={() => void disconnect()}>
            Disconnect
          </button>
        )}
      </div>

      <NowPlayingSection />
      {connected && <QueueSection />}
      <AIDJSection />
    </div>
  );
};
