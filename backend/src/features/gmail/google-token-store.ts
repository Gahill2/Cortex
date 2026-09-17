import type { Credentials } from "google-auth-library";
import { prisma } from "../../db/prisma.js";
import { createOAuthTokenStore } from "../integrations/oauth-token-store.js";

const googleTokenStore = createOAuthTokenStore<Credentials>("google");

export const saveGoogleCredentials = googleTokenStore.save;

/** Persist refreshed OAuth tokens (access + refresh) for legacy store and linked Mail accounts. */
export const persistGoogleCredentials = async (
  userId: string,
  credentials: Credentials,
  mailAccountId?: string
): Promise<void> => {
  await saveGoogleCredentials(userId, credentials);
  const json = JSON.stringify(credentials);
  if (mailAccountId) {
    await prisma.mailAccount.updateMany({
      where: { id: mailAccountId, userId, provider: "gmail" },
      data: { tokens: json },
    });
    return;
  }
  await prisma.mailAccount.updateMany({
    where: { userId, provider: "gmail" },
    data: { tokens: json },
  });
};

export const getGoogleCredentials = async (userId: string): Promise<Credentials | null> => {
  const mailRow = await prisma.mailAccount.findFirst({
    where: { userId, provider: "gmail" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  if (mailRow?.tokens) return JSON.parse(mailRow.tokens) as Credentials;

  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "google" } },
  });
  if (row) return JSON.parse(row.tokens) as Credentials;

  return null;
};

export const getGoogleCredentialsForEmail = async (
  userId: string,
  email: string
): Promise<{ credentials: Credentials; mailAccountId: string } | null> => {
  const mailRow = await prisma.mailAccount.findFirst({
    where: { userId, provider: "gmail", email },
  });
  if (!mailRow?.tokens) return null;
  return {
    credentials: JSON.parse(mailRow.tokens) as Credentials,
    mailAccountId: mailRow.id,
  };
};

export const clearGoogleCredentials = googleTokenStore.clear;
