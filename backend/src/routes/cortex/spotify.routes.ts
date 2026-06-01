import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { callAI } from "../../features/ai/ai-provider.js";
import { extractJsonObject } from "../../features/mail/mail-classify.js";
import { HttpError } from "../../utils/http-error.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { signSpotifyOAuthState, verifySpotifyOAuthState } from "../../features/spotify/spotify-state.js";
import {
  isSpotifyConfigured,
  buildSpotifyAuthUrl,
  exchangeSpotifyCode,
  getNowPlaying,
  playbackControl,
  setVolume,
  getValidSpotifyToken,
  createSpotifyPlaylist,
  searchSpotifyTracks,
  type SpotifyTrackResult,
} from "../../features/spotify/spotify-service.js";
import {
  saveSpotifyTokens,
  clearSpotifyTokens,
  isSpotifyConnected
} from "../../features/spotify/spotify-token-store.js";
import { oauthCallbackQuerySchema, spotifyPlaybackActionSchema } from "../../schemas/query-schemas.js";

const volumeSchema = z.object({
  volumePercent: z.number().min(0).max(100)
});

export const cortexSpotifyRouter = Router();

// ── Status ───────────────────────────────────────────────────────────────────

cortexSpotifyRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const configured = isSpotifyConfigured();
  const connected = configured && await isSpotifyConnected(req.auth!.userId);
  sendSuccess(res, { configured, connected });
});

// ── OAuth ────────────────────────────────────────────────────────────────────

cortexSpotifyRouter.get("/oauth/url", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  if (!isSpotifyConfigured()) {
    throw new HttpError(
      503,
      "Spotify OAuth not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI."
    );
  }
  const state = signSpotifyOAuthState(req.auth!.userId);
  const url = buildSpotifyAuthUrl(state);
  sendSuccess(res, { url });
});

// ── Desktop OAuth exchange (Electron deep-link flow) ─────────────────────────
// The browser redirects to cortex://oauth/spotify?code=X&state=Y
// Electron catches it and POSTs here to exchange the code.
cortexSpotifyRouter.post("/oauth/exchange", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  const { code, state } = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }).parse(req.body);
  const { userId } = verifySpotifyOAuthState(state);
  if (userId !== req.auth!.userId) throw new HttpError(403, "State userId mismatch");
  const tokens = await exchangeSpotifyCode(code);
  await saveSpotifyTokens(userId, tokens);
  sendSuccess(res, { connected: true });
});

cortexSpotifyRouter.get("/oauth/callback", routeRateLimit(60, 60_000), async (req, res) => {
  const frontend = env.CORTEX_FRONTEND_URL || "http://localhost:5173";
  try {
    const query = oauthCallbackQuerySchema.parse(req.query);
    if (query.error) {
      res.redirect(`${frontend}/?spotify_error=${encodeURIComponent(query.error)}`);
      return;
    }
    const { code, state } = query;
    if (!code || !state) {
      res.redirect(`${frontend}/?spotify_error=missing_code`);
      return;
    }
    const { userId } = verifySpotifyOAuthState(state);
    const tokens = await exchangeSpotifyCode(code);
    await saveSpotifyTokens(userId, tokens);
    res.redirect(`${frontend}/?spotify_connected=1`);
  } catch {
    res.redirect(`${frontend}/?spotify_error=oauth_failed`);
  }
});

// ── Now playing ──────────────────────────────────────────────────────────────

cortexSpotifyRouter.get("/now-playing", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) {
    sendSuccess(res, { configured: false, connected: false, playing: false });
    return;
  }
  if (!await isSpotifyConnected(req.auth!.userId)) {
    sendSuccess(res, { configured: true, connected: false, playing: false });
    return;
  }
  try {
    const result = await getNowPlaying(req.auth!.userId);
    sendSuccess(res, {
      configured: true,
      ...result,
      // Frontend expects `isPlaying` (API field is `playing`)
      isPlaying: result.playing
    });
  } catch (err) {
    throw new HttpError(
      502,
      err instanceof Error ? err.message : "Failed to load Spotify playback"
    );
  }
});

// ── Playback controls ────────────────────────────────────────────────────────

cortexSpotifyRouter.post("/playback/:action", requireAuth, routeRateLimit(60, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const { action } = spotifyPlaybackActionSchema.parse({ action: req.params.action });

  await playbackControl(req.auth!.userId, action);
  sendSuccess(res, { action });
});

cortexSpotifyRouter.put("/playback/volume", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const { volumePercent } = volumeSchema.parse(req.body);
  await setVolume(req.auth!.userId, volumePercent);
  sendSuccess(res, { volumePercent });
});

// ── Disconnect ───────────────────────────────────────────────────────────────

cortexSpotifyRouter.post("/disconnect", requireAuth, routeRateLimit(5, 60_000), async (req, res) => {
  await clearSpotifyTokens(req.auth!.userId);
  sendSuccess(res, { disconnected: true });
});

// ── AI DJ ────────────────────────────────────────────────────────────────────

const SPOTIFY_API = "https://api.spotify.com/v1";

const SPOTIFY_AI_SYSTEM = `You are a music expert. When given a mood or genre prompt, return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{ "playlistName": string, "tracks": Array<{ "artist": string, "title": string }> }
Include 12-15 diverse, real tracks that match the requested mood/genre. Vary artists — avoid repeating the same artist more than twice.`;

async function resolveTracksFromAiPrompt(
  userId: string,
  prompt: string,
  token: string,
): Promise<{
  playlistName: string;
  tracks: SpotifyTrackResult[];
  source: "ai" | "spotify-search";
  aiProvider?: string;
  aiWarning?: string;
}> {
  let playlistName = `Cortex: ${prompt.trim().slice(0, 50)}`;
  let aiTracks: Array<{ artist: string; title: string }> = [];
  let aiProvider: string | undefined;
  let aiWarning: string | undefined;

  try {
    const aiResult_raw = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", preferCloud: true, systemPrompt: SPOTIFY_AI_SYSTEM, maxTokens: 1024 },
    );
    aiProvider = aiResult_raw.provider;
    const parsed = extractJsonObject(aiResult_raw.text);
    if (parsed && Array.isArray(parsed.tracks)) {
      if (typeof parsed.playlistName === "string" && parsed.playlistName.trim()) {
        playlistName = parsed.playlistName.trim();
      }
      aiTracks = (parsed.tracks as Array<{ artist?: string; title?: string }>)
        .filter((t) => t?.artist && t?.title)
        .map((t) => ({ artist: String(t.artist), title: String(t.title) }));
    } else if (!parsed) {
      aiWarning = "AI returned invalid JSON — using Spotify search instead.";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/credit balance|billing|quota|insufficient/i.test(msg)) {
      throw new HttpError(
        503,
        "Anthropic API credits exhausted. Claude Pro/Max subscription does not include API access — add credits at console.anthropic.com or set OPENAI_API_KEY on the server.",
      );
    }
    aiWarning = `AI unavailable (${msg}) — using Spotify search instead.`;
    console.warn("[spotify] AI recommend failed, falling back to Spotify search:", err);
  }

  const foundTracks: SpotifyTrackResult[] = [];

  for (const { artist, title } of aiTracks) {
    try {
      const q = encodeURIComponent(`${artist} ${title}`);
      const r = await fetch(`${SPOTIFY_API}/search?q=${q}&type=track&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) continue;
      const data = (await r.json()) as {
        tracks: { items: Array<{
          id: string;
          name: string;
          uri: string;
          preview_url: string | null;
          artists: Array<{ name: string }>;
          album: { images: Array<{ url: string }> };
        }> };
      };
      const item = data.tracks?.items?.[0];
      if (!item) continue;
      foundTracks.push({
        id: item.id,
        name: item.name,
        artists: item.artists.map((a) => a.name),
        albumArt: item.album.images[0]?.url ?? null,
        uri: item.uri,
        previewUrl: item.preview_url,
      });
    } catch {
      /* best effort */
    }
  }

  if (foundTracks.length > 0) {
    return { playlistName, tracks: foundTracks, source: "ai", aiProvider, aiWarning };
  }

  const searched = await searchSpotifyTracks(userId, prompt, 15);
  if (searched.length === 0) {
    throw new HttpError(
      502,
      "Could not find tracks for that prompt. Try a genre, artist, or mood (e.g. \"indie rock workout\").",
    );
  }

  return { playlistName, tracks: searched, source: "spotify-search", aiProvider, aiWarning };
}

cortexSpotifyRouter.post("/ai/recommend", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  const { prompt } = z.object({ prompt: z.string().min(1).max(500) }).parse(req.body);

  const token = await getValidSpotifyToken(req.auth!.userId);

  try {
    const result = await resolveTracksFromAiPrompt(req.auth!.userId, prompt, token);
    sendSuccess(res, {
      tracks: result.tracks,
      prompt,
      playlistName: result.playlistName,
      source: result.source,
      aiProvider: result.aiProvider,
      aiWarning: result.aiWarning,
    }, "live");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      502,
      err instanceof Error ? err.message : "Failed to generate playlist recommendations",
    );
  }
});

cortexSpotifyRouter.post("/ai/create-playlist", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const { name, trackUris } = z.object({
    name: z.string().min(1).max(100),
    trackUris: z.array(z.string().min(1)).min(1).max(100)
  }).parse(req.body);

  try {
    const result = await createSpotifyPlaylist(req.auth!.userId, name, trackUris);
    sendSuccess(res, result);
  } catch (err) {
    throw new HttpError(502, err instanceof Error ? err.message : "Failed to create Spotify playlist");
  }
});

// ── Queue view ──────────────────────────────────────────────────────────────

cortexSpotifyRouter.get("/queue", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const token = await getValidSpotifyToken(req.auth!.userId);
  const r = await fetch(`${SPOTIFY_API}/me/player/queue`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!r.ok) throw new HttpError(502, `Spotify queue error: ${r.status}`);

  const data = await r.json() as {
    currently_playing: { name: string; artists: { name: string }[]; album: { name: string; images: { url: string }[] }; duration_ms: number } | null;
    queue: { name: string; artists: { name: string }[]; album: { name: string; images: { url: string }[] }; duration_ms: number; uri: string }[];
  };

  sendSuccess(res, {
    currentlyPlaying: data.currently_playing ? {
      name: data.currently_playing.name,
      artists: data.currently_playing.artists.map((a) => a.name),
      album: data.currently_playing.album.name,
      albumArt: data.currently_playing.album.images[0]?.url ?? null,
    } : null,
    queue: (data.queue ?? []).slice(0, 20).map((t) => ({
      name: t.name,
      artists: t.artists.map((a) => a.name),
      album: t.album.name,
      albumArt: t.album.images[0]?.url ?? null,
      durationMs: t.duration_ms,
      uri: t.uri,
    })),
  });
});

cortexSpotifyRouter.post("/playback/queue-track", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const { uri } = z.object({ uri: z.string().min(1) }).parse(req.body);
  const token = await getValidSpotifyToken(req.auth!.userId);

  const r = await fetch(`${SPOTIFY_API}/me/player/queue?uri=${encodeURIComponent(uri)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok && r.status !== 204) throw new HttpError(502, `Spotify queue error: ${r.status}`);

  sendSuccess(res, { queued: true });
});
