import { createOAuthTokenStore } from "../integrations/oauth-token-store.js";

export interface LinkedInTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
}

const store = createOAuthTokenStore<LinkedInTokens>("linkedin");

export const saveLinkedInTokens = store.save;
export const getLinkedInTokens = store.get;
export const clearLinkedInTokens = store.clear;
export const isLinkedInConnected = store.isConnected;
