import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("linkedin_oauth");

export const signLinkedInOAuthState = (userId: string): string => state.sign(userId);

export const verifyLinkedInOAuthState = (token: string): { userId: string } => ({
  userId: state.verify(token).userId,
});
