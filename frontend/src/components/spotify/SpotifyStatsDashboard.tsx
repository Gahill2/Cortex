import { useEffect, useState } from "react";
import { api } from "../../api/client";

type StatsArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  popularity: number | null;
  rank: number;
};

type StatsTrack = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  popularity: number | null;
  rank: number;
};

type StatsDashboard = {
  generatedAt: string;
  profile: { displayName: string; product: string | null; followers: number | null };
  summary: {
    topArtistShort: string | null;
    topArtistMedium: string | null;
    recentPlays24h: number;
    uniqueArtistsRecent: number;
    genreLeaders: Array<{ genre: string; count: number }>;
  };
  topArtists: {
    short_term: StatsArtist[];
    medium_term: StatsArtist[];
    long_term: StatsArtist[];
  };
  topTracks: {
    short_term: StatsTrack[];
    medium_term: StatsTrack[];
    long_term: StatsTrack[];
  };
  recent: Array<{ playedAt: string; track: StatsTrack }>;
  artistFrequency: Array<{ name: string; plays: number; imageUrl: string | null }>;
  needsScopes: boolean;
  catalogSearchAvailable: boolean;
};

type RangeKey = "short_term" | "medium_term" | "long_term";

const RANGE_LABELS: Record<RangeKey, string> = {
  short_term: "4 weeks",
  medium_term: "6 months",
  long_term: "All time",
};

function BarChart({
  items,
  maxValue,
  valueKey,
  labelKey,
  imageKey,
}: {
  items: Array<Record<string, unknown>>;
  maxValue: number;
  valueKey: string;
  labelKey: string;
  imageKey?: string;
}) {
  if (items.length === 0) return <p className="spotify-stats-empty">No data</p>;
  return (
    <div className="spotify-stats-bars">
      {items.map((item, i) => {
        const value = Number(item[valueKey]) || 0;
        const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
        const label = String(item[labelKey]);
        const img = imageKey ? (item[imageKey] as string | null) : null;
        return (
          <div key={`${label}-${i}`} className="spotify-stats-bar-row">
            {img ? <img src={img} alt="" className="spotify-stats-bar-thumb" /> : <span className="spotify-stats-bar-rank">{i + 1}</span>}
            <div className="spotify-stats-bar-body">
              <div className="spotify-stats-bar-label-row">
                <span className="spotify-stats-bar-label" title={label}>{label}</span>
                <span className="spotify-stats-bar-value">{value}</span>
              </div>
              <div className="spotify-stats-bar-track">
                <div className="spotify-stats-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ rows, columns }: { rows: StatsTrack[]; columns: Array<{ key: keyof StatsTrack | "artists"; label: string }> }) {
  if (rows.length === 0) return <p className="spotify-stats-empty">No data</p>;
  return (
    <div className="spotify-stats-table-wrap">
      <table className="spotify-stats-table">
        <thead>
          <tr>
            <th>#</th>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.rank}</td>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.key === "artists" ? row.artists.join(", ") : String(row[c.key as keyof StatsTrack] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpotifyStatsDashboard({ connected }: { connected: boolean }) {
  const [stats, setStats] = useState<StatsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("medium_term");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data?: StatsDashboard }>("/spotify/stats");
      setStats(r.data?.data ?? null);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(ax.response?.data?.error?.message ?? ax.message ?? "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) void load();
  }, [connected]);

  if (!connected) return null;

  return (
    <section className="spotify-stats-dashboard">
      <div className="spotify-stats-header">
        <div>
          <h2 className="spotify-stats-title">Listening analytics</h2>
          <p className="spotify-stats-subtitle">Your Spotify profile in one dashboard — like a personal Power BI view.</p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && <p className="spotify-ai-error">{error}</p>}
      {loading && !stats && (
        <div className="inline-loading" role="status">
          <span className="inline-loading-spinner" aria-hidden="true" />
          <span>Loading your stats…</span>
        </div>
      )}

      {stats && (
        <>
          {stats.needsScopes && (
            <p className="spotify-ai-warning">
              Limited data — disconnect and reconnect Spotify in Settings to grant top-artist and history scopes.
            </p>
          )}
          {!stats.catalogSearchAvailable && (
            <p className="spotify-ai-warning">
              Spotify catalog search is restricted for this app — AI playlists use your stats + cloud AI instead of search.
            </p>
          )}

          <div className="spotify-stats-kpis">
            <div className="spotify-stats-kpi">
              <span className="spotify-stats-kpi-label">Profile</span>
              <span className="spotify-stats-kpi-value">{stats.profile.displayName}</span>
              <span className="spotify-stats-kpi-meta">{stats.profile.product ?? "—"}</span>
            </div>
            <div className="spotify-stats-kpi">
              <span className="spotify-stats-kpi-label">#1 artist (4 wk)</span>
              <span className="spotify-stats-kpi-value">{stats.summary.topArtistShort ?? "—"}</span>
            </div>
            <div className="spotify-stats-kpi">
              <span className="spotify-stats-kpi-label">#1 artist (6 mo)</span>
              <span className="spotify-stats-kpi-value">{stats.summary.topArtistMedium ?? "—"}</span>
            </div>
            <div className="spotify-stats-kpi">
              <span className="spotify-stats-kpi-label">Plays (24h)</span>
              <span className="spotify-stats-kpi-value">{stats.summary.recentPlays24h}</span>
            </div>
            <div className="spotify-stats-kpi">
              <span className="spotify-stats-kpi-label">Artists in recent</span>
              <span className="spotify-stats-kpi-value">{stats.summary.uniqueArtistsRecent}</span>
            </div>
          </div>

          <div className="spotify-stats-range-tabs">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`spotify-stats-range-tab ${range === key ? "spotify-stats-range-tab--active" : ""}`}
                onClick={() => setRange(key)}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="spotify-stats-grid">
            <div className="spotify-stats-panel spotify-stats-panel--wide">
              <h3 className="spotify-stats-panel-title">Top artists · {RANGE_LABELS[range]}</h3>
              <BarChart
                items={stats.topArtists[range].map((a) => ({
                  name: a.name,
                  score: 21 - a.rank,
                  imageUrl: a.imageUrl,
                }))}
                maxValue={20}
                valueKey="score"
                labelKey="name"
                imageKey="imageUrl"
              />
            </div>

            <div className="spotify-stats-panel">
              <h3 className="spotify-stats-panel-title">Top genres</h3>
              <BarChart
                items={stats.summary.genreLeaders.map((g) => ({
                  name: g.genre,
                  score: g.count,
                }))}
                maxValue={stats.summary.genreLeaders[0]?.count ?? 1}
                valueKey="score"
                labelKey="name"
              />
            </div>

            <div className="spotify-stats-panel">
              <h3 className="spotify-stats-panel-title">Recent rotation</h3>
              <BarChart
                items={stats.artistFrequency.map((a) => ({
                  name: a.name,
                  score: a.plays,
                  imageUrl: a.imageUrl,
                }))}
                maxValue={stats.artistFrequency[0]?.plays ?? 1}
                valueKey="score"
                labelKey="name"
                imageKey="imageUrl"
              />
            </div>

            <div className="spotify-stats-panel spotify-stats-panel--full">
              <h3 className="spotify-stats-panel-title">Top tracks · {RANGE_LABELS[range]}</h3>
              <DataTable
                rows={stats.topTracks[range]}
                columns={[
                  { key: "name", label: "Track" },
                  { key: "artists", label: "Artist" },
                  { key: "album", label: "Album" },
                  { key: "popularity", label: "Pop." },
                ]}
              />
            </div>

            <div className="spotify-stats-panel spotify-stats-panel--full">
              <h3 className="spotify-stats-panel-title">Recently played</h3>
              <div className="spotify-stats-table-wrap">
                <table className="spotify-stats-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Track</th>
                      <th>Artist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.slice(0, 25).map((r) => (
                      <tr key={`${r.playedAt}-${r.track.id}`}>
                        <td>{new Date(r.playedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>{r.track.name}</td>
                        <td>{r.track.artists.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="spotify-stats-footer">
            Updated {new Date(stats.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}
