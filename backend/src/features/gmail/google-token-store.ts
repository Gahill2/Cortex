import type { Credentials } from "google-auth-library";
import { prisma } from "../../db/prisma.js";

export const saveGoogleCredentials = async (userId: string, credentials: Credentials): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "google" } },
    update: { tokens: JSON.stringify(credentials) },
    create: { userId, provider: "google", tokens: JSON.stringify(credentials) },
  });
};

export const getGoogleCredentials = async (userId: string): Promise<Credentials | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "google" } },
  });
  return row ? JSON.parse(row.tokens) as Credentials : null;
};

export const clearGoogleCredentials = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "google" } });
};
