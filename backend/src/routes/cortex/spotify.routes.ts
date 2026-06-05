import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  createPlaylistFromPrompt,
  generatePlaylistFromPrompt,
  getPlaylistSuggestionsForUser,
} from "../../features/spotify/spotify-ai-playlist.js";
import { getSpotifyStatsDashboard } from "../../features/spotify/spotify-stats.js";
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
  const showDialog = req.query.reconnect === "1" || req.query.reconnect === "true";
  const url = buildSpotifyAuthUrl(state, { showDialog });
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

cortexSpotifyRouter.get("/stats", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  try {
    const stats = await getSpotifyStatsDashboard(req.auth!.userId);
    sendSuccess(res, stats);
  } catch (err) {
    throw new HttpError(
      502,
      err instanceof Error ? err.message : "Failed to load Spotify stats",
    );
  }
});

cortexSpotifyRouter.get("/ai/suggestions", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  try {
    const result = await getPlaylistSuggestionsForUser(req.auth!.userId);
    sendSuccess(res, result);
  } catch (err) {
    throw new HttpError(
      502,
      err instanceof Error ? err.message : "Failed to load playlist suggestions",
    );
  }
});

cortexSpotifyRouter.post("/ai/recommend", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  const { prompt } = z.object({ prompt: z.string().min(1).max(500) }).parse(req.body);

  try {
    const result = await generatePlaylistFromPrompt(req.auth!.userId, prompt, 18);
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

cortexSpotifyRouter.post("/ai/create-from-prompt", requireAuth, routeRateLimit(8, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  const { prompt, name } = z.object({
    prompt: z.string().min(1).max(500),
    name: z.string().min(1).max(100).optional(),
  }).parse(req.body);

  try {
    const result = await createPlaylistFromPrompt(req.auth!.userId, prompt, name);
    sendSuccess(res, {
      playlistId: result.playlistId,
      playlistUrl: result.playlistUrl,
      playlistName: result.playlistName,
      trackCount: result.trackCount,
      source: result.source,
      aiProvider: result.aiProvider,
      aiWarning: result.aiWarning,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      502,
      err instanceof Error ? err.message : "Failed to create playlist",
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
