import { createOAuthTokenStore } from "../integrations/oauth-token-store.js";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const store = createOAuthTokenStore<SpotifyTokens>("spotify");

export const saveSpotifyTokens = store.save;
export const getSpotifyTokens = store.get;
export const clearSpotifyTokens = store.clear;
export const isSpotifyConnected = store.isConnected;
