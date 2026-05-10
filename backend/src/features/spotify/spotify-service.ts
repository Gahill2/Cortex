import { env } from "../../config/env.js";
import {
  getSpotifyTokens,
  saveSpotifyTokens,
  type SpotifyTokens
} from "./spotify-token-store.js";

const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";
const SPOTIFY_API = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-private",
  "user-read-email",
  "playlist-modify-public",
  "playlist-modify-private"
].join(" ");

export function isSpotifyConfigured(): boolean {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export function buildSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: env.SPOTIFY_REDIRECT_URI!,
    state
  });
  return `${SPOTIFY_ACCOUNTS}/authorize?${params}`;
}

export async function exchangeSpotifyCode(code: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI!
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`
    },
    body
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  };
}

// ── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(tokens: SpotifyTokens): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`
    },
    body
  });

  if (!res.ok) throw new Error("Spotify token refresh failed");

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  };
}

/** Get a valid access token, refreshing if expired (with 60s buffer). */
export async function getValidSpotifyToken(userId: string): Promise<string> {
  let tokens = await getSpotifyTokens(userId);
  if (!tokens) throw new Error("Not connected to Spotify");

  if (Date.now() > tokens.expires_at - 60_000) {
    tokens = await refreshAccessToken(tokens);
    await saveSpotifyTokens(userId, tokens);
  }

  return tokens.access_token;
}

// ── API calls ────────────────────────────────────────────────────────────────

export interface NowPlayingResult {
  connected: boolean;
  playing: boolean;
  track?: {
    id: string;
    name: string;
    artists: string[];
    album: string;
    albumArt: string | null;
    durationMs: number;
    progressMs: number;
  };
  device?: {
    name: string;
    type: string;
    volumePercent: number;
  };
}

export async function getNowPlaying(userId: string): Promise<NowPlayingResult> {
  const token = await getValidSpotifyToken(userId);

  const res = await fetch(`${SPOTIFY_API}/me/player`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // 204 = nothing playing
  if (res.status === 204) return { connected: true, playing: false };
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);

  const data = (await res.json()) as {
    is_playing: boolean;
    progress_ms: number;
    item?: {
      id: string;
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: {
        name: string;
        images: { url: string; width: number }[];
      };
    };
    device?: {
      name: string;
      type: string;
      volume_percent: number;
    };
  };

  const item = data.item;
  return {
    connected: true,
    playing: data.is_playing,
    track: item
      ? {
          id: item.id,
          name: item.name,
          artists: item.artists.map((a) => a.name),
          album: item.album.name,
          albumArt: item.album.images[0]?.url ?? null,
          durationMs: item.duration_ms,
          progressMs: data.progress_ms
        }
      : undefined,
    device: data.device
      ? {
          name: data.device.name,
          type: data.device.type,
          volumePercent: data.device.volume_percent
        }
      : undefined
  };
}

export async function playbackControl(
  userId: string,
  action: "play" | "pause" | "next" | "previous"
): Promise<void> {
  const token = await getValidSpotifyToken(userId);

  const actionMap: Record<string, { method: string; path: string }> = {
    play:     { method: "PUT",  path: "/me/player/play" },
    pause:    { method: "PUT",  path: "/me/player/pause" },
    next:     { method: "POST", path: "/me/player/next" },
    previous: { method: "POST", path: "/me/player/previous" }
  };

  const { method, path } = actionMap[action];
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  });

  // 204 is success for playback endpoints
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify playback error: ${res.status}`);
  }
}

export async function setVolume(userId: string, volumePercent: number): Promise<void> {
  const token = await getValidSpotifyToken(userId);
  const res = await fetch(
    `${SPOTIFY_API}/me/player/volume?volume_percent=${Math.round(volumePercent)}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 204) throw new Error(`Spotify volume error: ${res.status}`);
}
