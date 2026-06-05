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
  if (row) return JSON.parse(row.tokens) as Credentials;

  const mailRow = await prisma.mailAccount.findFirst({
    where: { userId, provider: "gmail" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });
  if (!mailRow?.tokens) return null;
  return JSON.parse(mailRow.tokens) as Credentials;
};

export const clearGoogleCredentials = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "google" } });
};
