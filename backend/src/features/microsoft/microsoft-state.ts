import { createOAuthState } from "../integrations/oauth-state.js";

const state = createOAuthState("microsoft", {
  invalid: "Invalid Microsoft OAuth state",
  expired: "Invalid or expired Microsoft OAuth state",
});

export const signMicrosoftState = (
  userId: string,
  opts?: { desktop?: boolean; returnOrigin?: string }
): string => state.sign(userId, opts);

export const verifyMicrosoftState = (
  token: string
): { userId: string; desktop: boolean; returnOrigin?: string } => state.verify(token);
