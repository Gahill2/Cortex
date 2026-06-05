import {
  getValidSpotifyToken,
  type SpotifyTrackResult,
} from "./spotify-service.js";
import { clampSpotifyLimit, searchSpotifyTracksSafe } from "./spotify-search.js";

const SPOTIFY_API = "https://api.spotify.com/v1";

type SpotifyTrackItem = {
  id: string;
  name: string;
  uri: string;
  preview_url: string | null;
  artists: Array<{ name: string }>;
  album: { images: Array<{ url: string }> };
};

function mapItem(item: SpotifyTrackItem): SpotifyTrackResult {
  return {
    id: item.id,
    name: item.name,
    artists: item.artists.map((a) => a.name),
    albumArt: item.album.images[0]?.url ?? null,
    uri: item.uri,
    previewUrl: item.preview_url,
  };
}

function promptTokens(prompt: string): string[] {
  const raw = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  const stop = new Set(["the", "and", "for", "with", "that", "like", "music", "playlist", "mix"]);
  return raw.filter((t) => !stop.has(t));
}

function scoreTrackForPrompt(track: SpotifyTrackResult, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const hay = `${track.name} ${track.artists.join(" ")}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 2;
  }
  return score;
}

async function spotifyGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) return null;
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function fetchTopTracks(token: string, timeRange: "short_term" | "medium_term"): Promise<SpotifyTrackResult[]> {
  const data = await spotifyGet<{ items?: SpotifyTrackItem[] }>(
    token,
    `/me/top/tracks?limit=20&time_range=${timeRange}`,
  );
  return (data?.items ?? []).map(mapItem);
}

async function fetchRecentTracks(token: string): Promise<SpotifyTrackResult[]> {
  const data = await spotifyGet<{ items?: Array<{ track?: SpotifyTrackItem }> }>(
    token,
    `/me/player/recently-played?limit=30`,
  );
  const out: SpotifyTrackResult[] = [];
  const seen = new Set<string>();
  for (const row of data?.items ?? []) {
    if (!row.track?.id || seen.has(row.track.id)) continue;
    seen.add(row.track.id);
    out.push(mapItem(row.track));
  }
  return out;
}

/** Spotify deprecated/restricted recommendations for many dev apps — best-effort only. */
async function fetchRecommendations(
  token: string,
  seedArtists: string[],
  seedTracks: string[],
  limit: number,
): Promise<SpotifyTrackResult[]> {
  if (!seedArtists.length && !seedTracks.length) return [];
  const params = new URLSearchParams({ limit: String(clampSpotifyLimit(limit)) });
  if (seedArtists.length) params.set("seed_artists", seedArtists.slice(0, 3).join(","));
  if (seedTracks.length) params.set("seed_tracks", seedTracks.slice(0, 2).join(","));
  if (!params.has("seed_artists") && !params.has("seed_tracks")) return [];

  const res = await fetch(`${SPOTIFY_API}/recommendations?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tracks?: SpotifyTrackItem[] };
  return (data.tracks ?? []).map(mapItem);
}

export type SpotifyListeningProfile = {
  topArtists: Array<{ id: string; name: string }>;
  topTracksShort: SpotifyTrackResult[];
  topTracksMedium: SpotifyTrackResult[];
  recent: SpotifyTrackResult[];
  needsScopes: boolean;
};

/** Snapshot of the user's Spotify taste for AI prompts and suggestions. */
export async function getSpotifyListeningProfile(userId: string): Promise<SpotifyListeningProfile> {
  const token = await getValidSpotifyToken(userId);
  const [topShort, topMed, recent, artistData] = await Promise.all([
    fetchTopTracks(token, "short_term"),
    fetchTopTracks(token, "medium_term"),
    fetchRecentTracks(token),
    spotifyGet<{ items?: Array<{ id: string; name: string }> }>(
      token,
      `/me/top/artists?limit=8&time_range=medium_term`,
    ),
  ]);
  const topArtists = (artistData?.items ?? []).map((a) => ({ id: a.id, name: a.name }));
  const topArtistIds = topArtists.map((a) => a.id);
  const needsScopes =
    topShort.length === 0 && topMed.length === 0 && recent.length === 0 && topArtistIds.length === 0;
  return {
    topArtists,
    topTracksShort: topShort,
    topTracksMedium: topMed,
    recent,
    needsScopes,
  };
}

export function formatListeningProfileForAi(profile: SpotifyListeningProfile): string {
  const lines: string[] = [];
  if (profile.topArtists.length) {
    lines.push(`Favorite artists: ${profile.topArtists.map((a) => a.name).join(", ")}`);
  }
  const topNames = [...profile.topTracksShort, ...profile.topTracksMedium]
    .slice(0, 12)
    .map((t) => `${t.name} — ${t.artists.join(", ")}`);
  if (topNames.length) lines.push(`Top tracks: ${topNames.join("; ")}`);
  if (profile.recent.length) {
    lines.push(
      `Recently played: ${profile.recent
        .slice(0, 8)
        .map((t) => `${t.name} — ${t.artists.join(", ")}`)
        .join("; ")}`,
    );
  }
  if (lines.length === 0) {
    return "No listening history available (user may need to reconnect Spotify for top-read scopes).";
  }
  return lines.join("\n");
}

export function buildPlaylistSuggestions(profile: SpotifyListeningProfile): Array<{
  id: string;
  label: string;
  prompt: string;
  description: string;
}> {
  const hour = new Date().getHours();
  const a1 = profile.topArtists[0]?.name;
  const a2 = profile.topArtists[1]?.name;
  const suggestions: Array<{ id: string; label: string; prompt: string; description: string }> = [];

  if (hour < 12) {
    suggestions.push({
      id: "morning-focus",
      label: "Morning focus",
      prompt: a1 ? `calm focus music similar to ${a1}, instrumental-friendly` : "calm morning focus instrumentals",
      description: "Light energy to start the day",
    });
  } else if (hour < 17) {
    suggestions.push({
      id: "afternoon-drive",
      label: "Afternoon mix",
      prompt: a1 && a2 ? `upbeat mix like ${a1} and ${a2}` : "upbeat indie and pop afternoon mix",
      description: "Keeps momentum through the afternoon",
    });
  } else {
    suggestions.push({
      id: "evening-wind-down",
      label: "Evening unwind",
      prompt: a1 ? `chill evening tracks similar to ${a1}, relaxed` : "chill evening lounge and downtempo",
      description: "Wind down tonight",
    });
  }

  if (a1) {
    suggestions.push({
      id: "more-like-top",
      label: `More like ${a1}`,
      prompt: `playlist in the style of ${a1}, deep cuts and similar artists`,
      description: "Based on your #1 artist",
    });
  }
  if (a2 && a1) {
    suggestions.push({
      id: "blend-favorites",
      label: "Favorite blend",
      prompt: `mix blending ${a1}, ${a2}, and similar artists`,
      description: "Your top artists together",
    });
  }

  suggestions.push({
    id: "discover-weekly-vibe",
    label: "Discover fresh",
    prompt: profile.recent.length
      ? `discover new songs similar to recent listens: ${profile.recent
          .slice(0, 3)
          .map((t) => t.artists[0])
          .filter(Boolean)
          .join(", ")}`
      : "discover weekly style — new indie and electronic",
    description: "Stretch your taste slightly",
  });

  suggestions.push({
    id: "workout-energy",
    label: "Workout energy",
    prompt: a1 ? `high energy workout tracks like ${a1} and similar artists` : "high energy workout pop and rock",
    description: "Fast tempo, motivating",
  });

  return suggestions.slice(0, 6);
}

function dedupeTracks(tracks: SpotifyTrackResult[], max: number): SpotifyTrackResult[] {
  const seen = new Set<string>();
  const out: SpotifyTrackResult[] = [];
  for (const t of tracks) {
    if (seen.has(t.uri)) continue;
    seen.add(t.uri);
    out.push(t);
    if (out.length >= max) return out;
  }
  return out;
}

/**
 * Build a playlist from the user's listening profile (no cloud LLM).
 * Uses top tracks/artists, recently played, and Spotify's recommendation API.
 */
export async function recommendTracksFromListeningProfile(
  userId: string,
  prompt: string,
  limit = 15,
): Promise<{ playlistName: string; tracks: SpotifyTrackResult[]; hint?: string }> {
  const token = await getValidSpotifyToken(userId);
  const tokens = promptTokens(prompt);
  const playlistName = `Cortex: ${prompt.trim().slice(0, 50)}`;

  const profile = await getSpotifyListeningProfile(userId);
  const topShort = profile.topTracksShort;
  const topMed = profile.topTracksMedium;
  const recent = profile.recent;
  const topArtistIds = profile.topArtists.map((a) => a.id);
  const needScopes = profile.needsScopes;

  const seedTrackIds = [...topShort, ...topMed].map((t) => t.id);
  const recommended = await fetchRecommendations(
    token,
    topArtistIds,
    seedTrackIds,
    clampSpotifyLimit(Math.min(limit + 10, 50)),
  );

  const libraryPool = dedupeTracks([...recommended, ...topShort, ...topMed, ...recent], 80);

  const ranked = libraryPool
    .map((t) => ({ t, score: scoreTrackForPrompt(t, tokens) }))
    .sort((a, b) => b.score - a.score);

  let picks = ranked.filter((r) => r.score > 0).map((r) => r.t);
  if (picks.length < Math.min(8, limit)) {
    picks = ranked.map((r) => r.t);
  }

  let tracks = dedupeTracks(picks, clampSpotifyLimit(limit));

  if (tracks.length < clampSpotifyLimit(limit)) {
    const searched = await searchSpotifyTracksSafe(userId, prompt, limit);
    tracks = dedupeTracks([...tracks, ...searched], clampSpotifyLimit(limit));
  }

  let hint: string | undefined;
  if (needScopes) {
    hint =
      "Reconnect Spotify in Settings for top tracks and listening history (user-top-read scope).";
  } else if (tracks.length > 0) {
    hint = "Built from your Spotify listening stats.";
  }

  return { playlistName, tracks, hint };
}
