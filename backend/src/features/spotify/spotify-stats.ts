import { getValidSpotifyToken } from "./spotify-service.js";

const SPOTIFY_API = "https://api.spotify.com/v1";

type TimeRange = "short_term" | "medium_term" | "long_term";

type ArtistItem = {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  genres?: string[];
  popularity?: number;
};

type TrackItem = {
  id: string;
  name: string;
  uri: string;
  popularity?: number;
  artists: Array<{ id: string; name: string }>;
  album: { name: string; images: Array<{ url: string }> };
};

export type SpotifyStatsArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  popularity: number | null;
  rank: number;
};

export type SpotifyStatsTrack = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  popularity: number | null;
  rank: number;
};

export type SpotifyStatsRecent = {
  playedAt: string;
  track: SpotifyStatsTrack;
};

export type SpotifyStatsDashboard = {
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
    short_term: SpotifyStatsArtist[];
    medium_term: SpotifyStatsArtist[];
    long_term: SpotifyStatsArtist[];
  };
  topTracks: {
    short_term: SpotifyStatsTrack[];
    medium_term: SpotifyStatsTrack[];
    long_term: SpotifyStatsTrack[];
  };
  recent: SpotifyStatsRecent[];
  artistFrequency: Array<{ name: string; plays: number; imageUrl: string | null }>;
  needsScopes: boolean;
  catalogSearchAvailable: boolean;
};

async function spotifyGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function mapArtist(a: ArtistItem, rank: number): SpotifyStatsArtist {
  return {
    id: a.id,
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? null,
    genres: a.genres ?? [],
    popularity: a.popularity ?? null,
    rank,
  };
}

function mapTrack(t: TrackItem, rank: number): SpotifyStatsTrack {
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name,
    albumArt: t.album.images?.[0]?.url ?? null,
    popularity: t.popularity ?? null,
    rank,
  };
}

async function fetchTopArtists(token: string, range: TimeRange): Promise<SpotifyStatsArtist[]> {
  const data = await spotifyGet<{ items?: ArtistItem[] }>(
    token,
    `/me/top/artists?limit=20&time_range=${range}`,
  );
  return (data?.items ?? []).map((a, i) => mapArtist(a, i + 1));
}

async function fetchTopTracks(token: string, range: TimeRange): Promise<SpotifyStatsTrack[]> {
  const data = await spotifyGet<{ items?: TrackItem[] }>(
    token,
    `/me/top/tracks?limit=20&time_range=${range}`,
  );
  return (data?.items ?? []).map((t, i) => mapTrack(t, i + 1));
}

async function fetchRecent(token: string): Promise<SpotifyStatsRecent[]> {
  const data = await spotifyGet<{
    items?: Array<{ played_at: string; track?: TrackItem }>;
  }>(token, `/me/player/recently-played?limit=50`);
  const out: SpotifyStatsRecent[] = [];
  for (const row of data?.items ?? []) {
    if (!row.track || !row.played_at) continue;
    out.push({
      playedAt: row.played_at,
      track: mapTrack(row.track, 0),
    });
  }
  return out;
}

function buildGenreLeaders(artists: SpotifyStatsArtist[]): Array<{ genre: string; count: number }> {
  const counts = new Map<string, number>();
  for (const a of artists) {
    for (const g of a.genres) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function buildArtistFrequency(recent: SpotifyStatsRecent[]): Array<{ name: string; plays: number; imageUrl: string | null }> {
  const map = new Map<string, { plays: number; imageUrl: string | null }>();
  for (const r of recent) {
    const name = r.track.artists[0] ?? "Unknown";
    const prev = map.get(name);
    map.set(name, {
      plays: (prev?.plays ?? 0) + 1,
      imageUrl: prev?.imageUrl ?? r.track.albumArt,
    });
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, plays: v.plays, imageUrl: v.imageUrl }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 15);
}

/** Probe whether catalog search works (dev-mode apps often get 400 "Invalid limit"). */
async function probeCatalogSearch(token: string): Promise<boolean> {
  const r = await fetch(`${SPOTIFY_API}/search?q=rock&type=track&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.ok;
}

export async function getSpotifyStatsDashboard(userId: string): Promise<SpotifyStatsDashboard> {
  const token = await getValidSpotifyToken(userId);

  const [me, shortA, medA, longA, shortT, medT, longT, recent, catalogOk] = await Promise.all([
    spotifyGet<{ display_name?: string; product?: string; followers?: { total?: number } }>(token, "/me"),
    fetchTopArtists(token, "short_term"),
    fetchTopArtists(token, "medium_term"),
    fetchTopArtists(token, "long_term"),
    fetchTopTracks(token, "short_term"),
    fetchTopTracks(token, "medium_term"),
    fetchTopTracks(token, "long_term"),
    fetchRecent(token),
    probeCatalogSearch(token),
  ]);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent24h = recent.filter((r) => new Date(r.playedAt).getTime() >= dayAgo);
  const uniqueArtistsRecent = new Set(recent.map((r) => r.track.artists.join(", "))).size;

  const needsScopes =
    shortA.length === 0 && medA.length === 0 && shortT.length === 0 && recent.length === 0;

  const genreLeaders = buildGenreLeaders([...shortA, ...medA].slice(0, 25));

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      displayName: me?.display_name?.trim() || "Spotify user",
      product: me?.product ?? null,
      followers: me?.followers?.total ?? null,
    },
    summary: {
      topArtistShort: shortA[0]?.name ?? null,
      topArtistMedium: medA[0]?.name ?? null,
      recentPlays24h: recent24h.length,
      uniqueArtistsRecent,
      genreLeaders,
    },
    topArtists: {
      short_term: shortA,
      medium_term: medA,
      long_term: longA,
    },
    topTracks: {
      short_term: shortT,
      medium_term: medT,
      long_term: longT,
    },
    recent,
    artistFrequency: buildArtistFrequency(recent),
    needsScopes,
    catalogSearchAvailable: catalogOk,
  };
}
