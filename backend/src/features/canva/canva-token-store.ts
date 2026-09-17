import { createOAuthTokenStore } from "../integrations/oauth-token-store.js";

export interface CanvaTokens {
  access_token: string;
  refresh_token: string;
  /** Epoch ms when access_token should be refreshed */
  expires_at: number;
  scope?: string;
}

const store = createOAuthTokenStore<CanvaTokens>("canva", { connectedWhen: "rowExists" });

export const saveCanvaTokens = store.save;
export const getCanvaTokens = store.get;
export const clearCanvaTokens = store.clear;
export const isCanvaConnected = store.isConnected;
