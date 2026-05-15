import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
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
  setVolume
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
