import { useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import { api } from "../api/client";
import { AIProviderBanner } from "../components/ai/AIProviderBanner";
import { SpotifyStatsDashboard } from "../components/spotify/SpotifyStatsDashboard";
import { useAIStatus } from "../hooks/useAIStatus";
import { startOAuthFlow } from "../lib/oauth";

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

interface PlaylistSuggestion {
  id: string;
  label: string;
  prompt: string;
  description: string;
}

function sourceHint(source?: string, aiProvider?: string): string | null {
  if (!source) return null;
  if (source === "ai-cloud") return aiProvider ? `Curated with ${aiProvider} + your Spotify taste.` : "Curated with cloud AI + your Spotify taste.";
  if (source === "ai-local") return "Curated with local Ollama + your Spotify taste.";
  if (source === "blend") return "Mix of AI picks and your listening profile.";
  if (source === "spotify-taste") return "Built from your Spotify top tracks and artists.";
  if (source === "spotify-search") return "Matched via Spotify search.";
  return null;
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

  const openConnect = () => {
    startOAuthFlow(connectUrl);
  };

  // Re-connect after OAuth completes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ provider: string }>).detail;
      if (detail?.provider === "spotify" || detail?.provider === "refresh") void load();
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
        <div className="inline-loading" role="status"><span className="inline-loading-spinner" aria-hidden="true" /><span>Loading…</span></div>
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
          <Music size={40} strokeWidth={1.5} className="spotify-np-icon" aria-hidden />
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
          <Music size={40} strokeWidth={1.5} className="spotify-np-icon" aria-hidden />
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
      {track.albumArt ? (
        <div
          className="spotify-np-backdrop"
          style={{ backgroundImage: `url(${track.albumArt})` }}
          aria-hidden
        />
      ) : null}
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
  const { status: aiStatus, loading: aiStatusLoading } = useAIStatus();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AIDJTrack[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ name: string; url: string } | null>(null);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [recommendMeta, setRecommendMeta] = useState<{ source?: string; aiProvider?: string; aiWarning?: string } | null>(null);
  const [suggestions, setSuggestions] = useState<PlaylistSuggestion[]>([]);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    api.get<{ data?: { connected?: boolean } }>("/spotify/status")
      .then((r) => setConnected(r.data?.data?.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) return;
    setSuggestionsLoading(true);
    api
      .get<{ data?: { suggestions?: PlaylistSuggestion[]; needsReconnect?: boolean } }>(
        "/spotify/ai/suggestions",
      )
      .then((r) => {
        setSuggestions(r.data?.data?.suggestions ?? []);
        setNeedsReconnect(r.data?.data?.needsReconnect ?? false);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [connected]);

  const generate = async (promptOverride?: string) => {
    const msg = (promptOverride ?? prompt).trim();
    if (!msg) return;
    if (promptOverride) setPrompt(promptOverride);
    setLoading(true);
    setError(null);
    setTracks([]);
    setSaveResult(null);
    setSelected(new Set());
    setRecommendMeta(null);
    try {
      const r = await api.post<{
        data?: {
          tracks: AIDJTrack[];
          playlistName: string;
          source?: string;
          aiProvider?: string;
          aiWarning?: string;
        };
      }>("/spotify/ai/recommend", { prompt: msg });
      const result = r.data?.data;
      if (!result) throw new Error("Empty response");
      setTracks(result.tracks);
      setPlaylistName(result.playlistName);
      setSelected(new Set(result.tracks.map((t) => t.uri)));
      setRecommendMeta({
        source: result.source,
        aiProvider: result.aiProvider,
        aiWarning: result.aiWarning,
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const errMsg = ax.response?.data?.error?.message ?? ax.message ?? "Request failed";
      setError(
        `Could not find tracks: ${errMsg}. Try a simple prompt (artist, genre, or mood) — e.g. "indie rock" or "Daft Punk".`,
      );
    } finally {
      setLoading(false);
    }
  };

  const saveDirectToSpotify = async () => {
    const msg = prompt.trim();
    if (!msg) return;
    setQuickSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const r = await api.post<{
        data?: { playlistUrl: string; playlistName: string; trackCount?: number; aiWarning?: string; source?: string; aiProvider?: string };
      }>("/spotify/ai/create-from-prompt", { prompt: msg, name: playlistName.trim() || undefined });
      const result = r.data?.data;
      if (!result?.playlistUrl) throw new Error("Empty response");
      setSaveResult({ name: result.playlistName, url: result.playlistUrl });
      setRecommendMeta({
        source: result.source,
        aiProvider: result.aiProvider,
        aiWarning: result.aiWarning,
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(ax.response?.data?.error?.message ?? ax.message ?? "Failed to save playlist to Spotify.");
    } finally {
      setQuickSaving(false);
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
      setError(ax.response?.data?.error?.message ?? "Failed to save playlist. Try disconnecting and reconnecting Spotify in Settings.");
    } finally {
      setSaving(false);
    }
  };

  if (connected === null) {
    return (
      <section className="spotify-ai-dj">
        <div className="inline-loading" role="status"><span className="inline-loading-spinner" aria-hidden="true" /><span>Checking Spotify…</span></div>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="spotify-ai-dj">
        <div className="spotify-ai-empty">
          <Music size={32} strokeWidth={1.5} className="spotify-np-icon" aria-hidden />
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
        <p className="spotify-ai-subtitle">
          Personalized playlists from your listening history — curated with AI when available.
        </p>
      </div>

      <AIProviderBanner status={aiStatus} loading={aiStatusLoading} compact />

      {needsReconnect && (
        <p className="spotify-ai-warning">
          Reconnect Spotify in Settings for top artists and recent plays — suggestions work best with full access.
        </p>
      )}

      {(suggestions.length > 0 || suggestionsLoading) && (
        <div className="spotify-ai-suggestions">
          <p className="spotify-ai-suggestions-label">Suggested for you</p>
          {suggestionsLoading ? (
            <p className="spotify-ai-hint">Loading ideas…</p>
          ) : (
            <div className="spotify-ai-suggestion-chips">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="spotify-ai-suggestion-chip"
                  title={s.description}
                  disabled={loading || quickSaving}
                  onClick={() => void generate(s.prompt)}
                >
                  <span className="spotify-ai-suggestion-chip-label">{s.label}</span>
                  <span className="spotify-ai-suggestion-chip-desc">{s.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        className="spotify-ai-form"
        onSubmit={(e) => { e.preventDefault(); void generate(); }}
      >
        <input
          className="spotify-ai-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. chill synthwave for coding, or more like my top artists"
          disabled={loading || quickSaving}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || quickSaving || !prompt.trim()}
        >
          {loading ? "Curating…" : "Preview tracks"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading || quickSaving || !prompt.trim()}
          onClick={() => void saveDirectToSpotify()}
          title="Generate and save directly to your Spotify library"
        >
          {quickSaving ? "Saving to Spotify…" : "Save to Spotify"}
        </button>
      </form>

      {error && <p className="spotify-ai-error">{error}</p>}
      {recommendMeta?.aiWarning && !error && (
        <p className="spotify-ai-warning">{recommendMeta.aiWarning}</p>
      )}
      {!error && !recommendMeta?.aiWarning && recommendMeta?.source && (
        <p className="spotify-ai-hint">{sourceHint(recommendMeta.source, recommendMeta.aiProvider)}</p>
      )}

      {loading && (
        <div className="spotify-ai-loading">
          <div className="spotify-ai-loading-dots">
            <span />
            <span />
            <span />
          </div>
          <p>AI is curating tracks from your taste profile and resolving them on Spotify…</p>
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

  if (loading) return <section className="spotify-section"><div className="inline-loading" role="status"><span className="inline-loading-spinner" aria-hidden="true" /><span>Loading queue…</span></div></section>;
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
        <div className="empty-state" style={{ padding: "20px 16px" }}>
          <Music size={28} strokeWidth={1.5} className="empty-state-icon" aria-hidden />
          <p className="empty-state-message">Queue is empty — play something to see upcoming tracks.</p>
        </div>
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
    <div className="page spotify-page spotify-page--spicetify">
      <div className="page-titlebar">
        <h1 className="page-title">♫ Spotify</h1>
        {connected && (
          <button className="btn-ghost btn-sm" onClick={() => void disconnect()}>
            Disconnect
          </button>
        )}
      </div>

      <NowPlayingSection />
      <SpotifyStatsDashboard connected={connected === true} />
      {connected && <QueueSection />}
      <AIDJSection />
    </div>
  );
};
