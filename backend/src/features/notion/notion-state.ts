import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("notion_oauth");

export const signNotionOAuthState = (userId: string): string => state.sign(userId);

export const verifyNotionOAuthState = (token: string): { userId: string } => ({
  userId: state.verify(token).userId,
});
