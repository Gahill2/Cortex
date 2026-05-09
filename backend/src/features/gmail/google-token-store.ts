import type { Credentials } from "google-auth-library";

const tokensByUserId = new Map<string, Credentials>();

export const saveGoogleCredentials = (userId: string, credentials: Credentials): void => {
  tokensByUserId.set(userId, credentials);
};

export const getGoogleCredentials = (userId: string): Credentials | null => tokensByUserId.get(userId) ?? null;

export const clearGoogleCredentials = (userId: string): void => {
  tokensByUserId.delete(userId);
};

/** Test helper */
export const resetGoogleTokenStoreForTests = (): void => {
  tokensByUserId.clear();
};
