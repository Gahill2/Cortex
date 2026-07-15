import { createOAuthTokenStore } from "../integrations/oauth-token-store.js";

export interface NotionOAuthTokens {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
}

const store = createOAuthTokenStore<NotionOAuthTokens>("notion", { connectedWhen: "rowExists" });

export const saveNotionTokens = store.save;
export const getNotionTokens = store.get;
export const clearNotionTokens = store.clear;
export const isNotionUserConnected = store.isConnected;
