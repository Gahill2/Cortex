export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const tokensByUserId = new Map<string, SpotifyTokens>();

export const saveSpotifyTokens = (userId: string, tokens: SpotifyTokens): void => {
  tokensByUserId.set(userId, tokens);
};

export const getSpotifyTokens = (userId: string): SpotifyTokens | null =>
  tokensByUserId.get(userId) ?? null;

export const clearSpotifyTokens = (userId: string): void => {
  tokensByUserId.delete(userId);
};

export const isSpotifyConnected = (userId: string): boolean =>
  tokensByUserId.has(userId);
