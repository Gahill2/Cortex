import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("gmail_oauth");

export const signGmailOAuthState = (
  userId: string,
  opts?: { desktop?: boolean; returnOrigin?: string }
): string => state.sign(userId, opts);

export const verifyGmailOAuthState = (
  token: string
): { userId: string; desktop: boolean; returnOrigin?: string } => state.verify(token);
