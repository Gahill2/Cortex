import { callAI, getAIStatus, type AIProviderId } from "../ai/ai-provider.js";
import { extractJsonObject } from "../mail/mail-classify.js";
import {
  getValidSpotifyToken,
  createSpotifyPlaylist,
  type SpotifyTrackResult,
} from "./spotify-service.js";
import { clampSpotifyLimit, searchSpotifyTracksSafe } from "./spotify-search.js";
import {
  buildPlaylistSuggestions,
  formatListeningProfileForAi,
  getSpotifyListeningProfile,
  recommendTracksFromListeningProfile,
  type SpotifyListeningProfile,
} from "./spotify-taste.js";

const SPOTIFY_API = "https://api.spotify.com/v1";

const PLAYLIST_AI_SYSTEM = `You are a personal DJ curating Spotify playlists. Return ONLY valid JSON (no markdown):
{"playlistName": string, "tracks": [{"artist": string, "title": string}]}
Rules:
- Include 14-18 real tracks that exist on Spotify.
- Match the user's request AND their taste profile when provided.
- Prefer variety; no duplicate songs; include deep cuts and similar artists, not only hits.
- playlistName: short, catchy (max 50 chars), no "Cortex:" prefix.`;

export type PlaylistSource = "ai-cloud" | "ai-local" | "spotify-taste" | "spotify-search" | "blend";

export type GeneratePlaylistResult = {
  playlistName: string;
  tracks: SpotifyTrackResult[];
  source: PlaylistSource;
  aiProvider?: AIProviderId;
  aiWarning?: string;
  suggestions?: ReturnType<typeof buildPlaylistSuggestions>;
};

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

async function resolveAiTracksOnSpotify(
  token: string,
  aiTracks: Array<{ artist: string; title: string }>,
): Promise<SpotifyTrackResult[]> {
  const found: SpotifyTrackResult[] = [];
  const batch = aiTracks.slice(0, 20);
  await Promise.all(
    batch.map(async ({ artist, title }) => {
      try {
        const q = encodeURIComponent(`artist:${artist} track:${title}`);
        const r = await fetch(`${SPOTIFY_API}/search?q=${q}&type=track&limit=3`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = (await r.json()) as {
          tracks?: {
            items?: Array<{
              id: string;
              name: string;
              uri: string;
              preview_url: string | null;
              artists: Array<{ name: string }>;
              album: { images: Array<{ url: string }> };
            }>;
          };
        };
        const items = data.tracks?.items ?? [];
        const match =
          items.find(
            (i) =>
              i.name.toLowerCase().includes(title.toLowerCase().slice(0, 8)) ||
              title.toLowerCase().includes(i.name.toLowerCase().slice(0, 8)),
          ) ?? items[0];
        if (!match) return;
        found.push({
          id: match.id,
          name: match.name,
          artists: match.artists.map((a) => a.name),
          albumArt: match.album.images[0]?.url ?? null,
          uri: match.uri,
          previewUrl: match.preview_url,
        });
      } catch {
        /* skip */
      }
    }),
  );
  return dedupeTracks(found, 20);
}

async function curateWithAi(
  prompt: string,
  profile: SpotifyListeningProfile,
): Promise<{
  playlistName: string;
  tracks: Array<{ artist: string; title: string }>;
  provider: AIProviderId;
} | null> {
  const status = await getAIStatus();
  const anyAi =
    status.ollama || status.anthropic || status.kimi || status.openai;
  if (!anyAi) return null;

  const userContent = `Request: ${prompt.trim()}\n\nUser taste:\n${formatListeningProfileForAi(profile)}`;

  try {
    const aiResult = await callAI([{ role: "user", content: userContent }], {
      tier: "simple",
      systemPrompt: PLAYLIST_AI_SYSTEM,
      maxTokens: 1400,
    });
    const parsed = extractJsonObject(aiResult.text);
    if (!parsed || !Array.isArray(parsed.tracks)) return null;

    const tracks = (parsed.tracks as Array<{ artist?: string; title?: string }>)
      .filter((t) => t?.artist && t?.title)
      .map((t) => ({ artist: String(t.artist).trim(), title: String(t.title).trim() }));

    if (tracks.length < 4) return null;

    const playlistName =
      typeof parsed.playlistName === "string" && parsed.playlistName.trim()
        ? parsed.playlistName.trim().slice(0, 80)
        : `Mix: ${prompt.trim().slice(0, 40)}`;

    return { playlistName, tracks, provider: aiResult.provider };
  } catch (err) {
    console.warn("[spotify-ai] LLM playlist curation failed:", err);
    return null;
  }
}

/** Full pipeline: AI curation + Spotify taste + search fallback. */
export async function generatePlaylistFromPrompt(
  userId: string,
  prompt: string,
  limit = 15,
): Promise<GeneratePlaylistResult> {
  const token = await getValidSpotifyToken(userId);
  const profile = await getSpotifyListeningProfile(userId);
  const trackLimit = clampSpotifyLimit(limit);
  const taste = await recommendTracksFromListeningProfile(userId, prompt, trackLimit);

  let playlistName = taste.playlistName.replace(/^Cortex:\s*/i, "").trim() || prompt.trim().slice(0, 50);
  let aiWarning = taste.hint;
  let source: PlaylistSource = "spotify-taste";
  let aiProvider: AIProviderId | undefined;

  const aiCurated = await curateWithAi(prompt, profile);
  let merged: SpotifyTrackResult[] = [];

  if (aiCurated) {
    const resolved = await resolveAiTracksOnSpotify(token, aiCurated.tracks);
    if (resolved.length >= 4) {
      playlistName = aiCurated.playlistName;
      merged = dedupeTracks([...resolved, ...taste.tracks], trackLimit);
      source = aiCurated.provider === "ollama" ? "ai-local" : "ai-cloud";
      aiProvider = aiCurated.provider;
      aiWarning =
        profile.needsScopes
          ? `Curated with ${aiCurated.provider}. Reconnect Spotify for richer taste data.`
          : `Curated with ${aiCurated.provider} using your listening profile.`;
    }
  }

  if (merged.length < trackLimit) {
    merged = dedupeTracks([...merged, ...taste.tracks], trackLimit);
    if (merged.length > 0 && source === "spotify-taste") {
      aiWarning = taste.hint ?? "Built from your Spotify stats.";
    }
  }

  if (merged.length < Math.min(8, trackLimit)) {
    const searched = await searchSpotifyTracksSafe(userId, prompt, trackLimit);
    merged = dedupeTracks([...merged, ...searched], trackLimit);
    if (searched.length > 0) {
      source = merged.length === searched.length ? "spotify-search" : "blend";
      aiWarning = aiWarning ?? "Filled gaps via Spotify search.";
    }
  }

  if (merged.length === 0 && taste.tracks.length > 0) {
    merged = dedupeTracks(taste.tracks, trackLimit);
    source = "spotify-taste";
    aiWarning = taste.hint ?? "Using your library stats (Spotify search unavailable for this app).";
  }

  if (merged.length === 0) {
    const catalogNote = profile.needsScopes
      ? "Reconnect Spotify in Settings for listening-history access."
      : "Enable cloud AI in Settings, or try a shorter prompt with an artist or genre.";
    throw new Error(`Could not find tracks. ${catalogNote}`);
  }

  if (aiCurated && taste.tracks.length > 0 && source.startsWith("ai")) {
    source = "blend";
  }

  return {
    playlistName,
    tracks: merged,
    source,
    aiProvider,
    aiWarning,
  };
}

export async function getPlaylistSuggestionsForUser(userId: string) {
  const profile = await getSpotifyListeningProfile(userId);
  return {
    suggestions: buildPlaylistSuggestions(profile),
    topArtists: profile.topArtists.map((a) => a.name).slice(0, 5),
    needsReconnect: profile.needsScopes,
  };
}

/** Recommend tracks then save as a Spotify playlist in one step. */
export async function createPlaylistFromPrompt(
  userId: string,
  prompt: string,
  nameOverride?: string,
): Promise<{
  playlistName: string;
  playlistId: string;
  playlistUrl: string;
  trackCount: number;
  source: PlaylistSource;
  aiProvider?: AIProviderId;
  aiWarning?: string;
}> {
  const generated = await generatePlaylistFromPrompt(userId, prompt, 18);
  const name = (nameOverride?.trim() || generated.playlistName).slice(0, 100);
  const uris = generated.tracks.map((t) => t.uri);
  const saved = await createSpotifyPlaylist(userId, name, uris);
  return {
    playlistName: name,
    playlistId: saved.playlistId,
    playlistUrl: saved.playlistUrl,
    trackCount: uris.length,
    source: generated.source,
    aiProvider: generated.aiProvider,
    aiWarning: generated.aiWarning,
  };
}
