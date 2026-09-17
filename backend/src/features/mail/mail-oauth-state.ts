import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("mail_gmail");

export const signMailOAuthState = (
  userId: string,
  opts?: { desktop?: boolean; returnOrigin?: string }
): string => state.sign(userId, opts);

export const verifyMailOAuthState = (
  token: string
): { userId: string; desktop: boolean; returnOrigin?: string } => state.verify(token);
