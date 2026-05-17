import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { callAI } from "../../features/ai/ai-provider.js";
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
  getValidSpotifyToken
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

cortexSpotifyRouter.post("/ai/recommend", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");
  const { prompt } = z.object({ prompt: z.string().min(1).max(500) }).parse(req.body);

  // Step 1: Ask AI for track recommendations (Ollama → Anthropic fallback)
  const aiResult_raw = await callAI(
    [{ role: "user", content: prompt }],
    {
      tier: "simple",
      systemPrompt: `You are a music expert. When given a mood or genre prompt, return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{ "playlistName": string, "tracks": Array<{ "artist": string, "title": string }> }
Include 12-15 diverse, real tracks that match the requested mood/genre. Vary artists — avoid repeating the same artist more than twice.`,
      maxTokens: 1024
    }
  );

  const rawText = aiResult_raw.text.trim();
  let aiResult: { playlistName: string; tracks: Array<{ artist: string; title: string }> };
  try {
    // Strip possible markdown code fences
    const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    aiResult = JSON.parse(cleaned);
  } catch {
    throw new HttpError(502, "AI returned invalid JSON for track recommendations");
  }

  // Step 2: Search Spotify for each recommended track
  const token = await getValidSpotifyToken(req.auth!.userId);
  const foundTracks: Array<{
    id: string;
    name: string;
    artists: string[];
    albumArt: string | null;
    uri: string;
    previewUrl: string | null;
  }> = [];

  for (const { artist, title } of aiResult.tracks) {
    try {
      const q = encodeURIComponent(`${artist} ${title}`);
      const r = await fetch(`${SPOTIFY_API}/search?q=${q}&type=track&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
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
        }> }
      };
      const item = data.tracks?.items?.[0];
      if (!item) continue;
      foundTracks.push({
        id: item.id,
        name: item.name,
        artists: item.artists.map((a) => a.name),
        albumArt: item.album.images[0]?.url ?? null,
        uri: item.uri,
        previewUrl: item.preview_url
      });
    } catch {
      // Skip tracks that fail to search — best effort
    }
  }

  sendSuccess(res, { tracks: foundTracks, prompt, playlistName: aiResult.playlistName });
});

cortexSpotifyRouter.post("/ai/create-playlist", requireAuth, routeRateLimit(10, 60_000), async (req, res) => {
  if (!isSpotifyConfigured()) throw new HttpError(503, "Spotify not configured");
  if (!await isSpotifyConnected(req.auth!.userId)) throw new HttpError(401, "Spotify not connected");

  const { name, trackUris } = z.object({
    name: z.string().min(1).max(100),
    trackUris: z.array(z.string().min(1)).min(1).max(100)
  }).parse(req.body);

  const token = await getValidSpotifyToken(req.auth!.userId);

  // Step 1: Get the Spotify user's profile
  const profileRes = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!profileRes.ok) throw new HttpError(502, "Failed to fetch Spotify profile");
  const profile = (await profileRes.json()) as { id: string };

  // Step 2: Create the playlist
  const createRes = await fetch(`${SPOTIFY_API}/users/${profile.id}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: "Created by Cortex AI", public: false })
  });
  if (!createRes.ok) throw new HttpError(502, "Failed to create Spotify playlist");
  const playlist = (await createRes.json()) as { id: string; external_urls: { spotify: string } };

  // Step 3: Add tracks to the playlist
  const addRes = await fetch(`${SPOTIFY_API}/playlists/${playlist.id}/tracks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: trackUris })
  });
  if (!addRes.ok) throw new HttpError(502, "Failed to add tracks to playlist");

  sendSuccess(res, {
    playlistId: playlist.id,
    playlistUrl: playlist.external_urls.spotify
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
