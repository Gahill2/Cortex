import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("spotify_oauth");

export const signSpotifyOAuthState = (userId: string): string => state.sign(userId);

export const verifySpotifyOAuthState = (token: string): { userId: string } => ({
  userId: state.verify(token).userId,
});
