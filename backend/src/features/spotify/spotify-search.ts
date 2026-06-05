import { getValidSpotifyToken, type SpotifyTrackResult } from "./spotify-service.js";

const SPOTIFY_API = "https://api.spotify.com/v1";

/** Spotify requires limit 1–50 on search/recommendations. */
export function clampSpotifyLimit(limit: number): number {
  const n = Math.floor(Number(limit));
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 50);
}

/** Shorten natural-language prompts for Spotify search (catalog API is picky). */
export function toSpotifySearchQuery(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const unique = [...new Set(words)];
  if (unique.length === 0) return prompt.trim().slice(0, 80);
  return unique.slice(0, 10).join(" ");
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "like", "want", "need",
  "playlist", "music", "songs", "tracks", "similar", "style", "mix", "some",
  "very", "really", "into", "about", "would", "could", "should", "make", "give",
]);

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

async function searchOnce(
  token: string,
  query: string,
  limit: number,
): Promise<SpotifyTrackResult[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const lim = clampSpotifyLimit(limit);
  const r = await fetch(`${SPOTIFY_API}/search?q=${q}&type=track&limit=${lim}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.warn(`[spotify] search failed (${r.status}) q="${query.slice(0, 40)}": ${body.slice(0, 120)}`);
    return [];
  }
  const data = (await r.json()) as { tracks?: { items?: SpotifyTrackItem[] } };
  return (data.tracks?.items ?? []).map(mapItem);
}

/** Search tracks; never throws (Spotify dev apps often return misleading "Invalid limit"). */
export async function searchSpotifyTracksSafe(
  userId: string,
  query: string,
  limit = 15,
): Promise<SpotifyTrackResult[]> {
  const token = await getValidSpotifyToken(userId);
  const lim = clampSpotifyLimit(limit);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const attempts = [
    toSpotifySearchQuery(trimmed),
    trimmed.slice(0, 80),
    trimmed.split(/\s+/).slice(0, 4).join(" "),
  ].filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i);

  const seen = new Set<string>();
  const out: SpotifyTrackResult[] = [];
  for (const q of attempts) {
    const batch = await searchOnce(token, q, lim);
    for (const t of batch) {
      if (seen.has(t.uri)) continue;
      seen.add(t.uri);
      out.push(t);
      if (out.length >= lim) return out;
    }
    if (out.length >= Math.min(8, lim)) break;
  }
  return out;
}
