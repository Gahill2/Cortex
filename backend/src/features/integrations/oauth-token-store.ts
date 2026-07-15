import { prisma } from "../../db/prisma.js";

/**
 * Shared CRUD helpers for OAuth tokens persisted in the `oAuthToken` table,
 * keyed by (userId, provider). Each integration builds a typed store instead of
 * re-implementing the same upsert/find/delete logic.
 */
export interface OAuthTokenStore<T> {
  save: (userId: string, tokens: T) => Promise<void>;
  get: (userId: string) => Promise<T | null>;
  clear: (userId: string) => Promise<void>;
  isConnected: (userId: string) => Promise<boolean>;
}

export interface OAuthTokenStoreOptions {
  /**
   * How `isConnected` decides connectivity:
   * - `"hasToken"` (default): a stored access_token or refresh_token is present.
   * - `"rowExists"`: any token row exists for the provider.
   */
  connectedWhen?: "hasToken" | "rowExists";
}

export const createOAuthTokenStore = <T>(
  provider: string,
  options: OAuthTokenStoreOptions = {}
): OAuthTokenStore<T> => {
  const { connectedWhen = "hasToken" } = options;

  const save = async (userId: string, tokens: T): Promise<void> => {
    const serialized = JSON.stringify(tokens);
    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider } },
      update: { tokens: serialized },
      create: { userId, provider, tokens: serialized },
    });
  };

  const get = async (userId: string): Promise<T | null> => {
    const row = await prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!row) return null;
    return JSON.parse(row.tokens) as T;
  };

  const clear = async (userId: string): Promise<void> => {
    await prisma.oAuthToken.deleteMany({ where: { userId, provider } });
  };

  const isConnected = async (userId: string): Promise<boolean> => {
    if (connectedWhen === "rowExists") {
      const row = await prisma.oAuthToken.findUnique({
        where: { userId_provider: { userId, provider } },
      });
      return Boolean(row);
    }
    const tokens = (await get(userId)) as
      | { access_token?: string; refresh_token?: string }
      | null;
    return Boolean(tokens?.refresh_token || tokens?.access_token);
  };

  return { save, get, clear, isConnected };
};
