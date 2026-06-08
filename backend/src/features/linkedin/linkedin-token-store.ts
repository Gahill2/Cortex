import { prisma } from "../../db/prisma.js";

export interface LinkedInTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
}

export const saveLinkedInTokens = async (userId: string, tokens: LinkedInTokens): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "linkedin" } },
    update: { tokens: JSON.stringify(tokens) },
    create: { userId, provider: "linkedin", tokens: JSON.stringify(tokens) },
  });
};

export const getLinkedInTokens = async (userId: string): Promise<LinkedInTokens | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "linkedin" } },
  });
  if (!row) return null;
  return JSON.parse(row.tokens) as LinkedInTokens;
};

export const clearLinkedInTokens = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "linkedin" } });
};

export const isLinkedInConnected = async (userId: string): Promise<boolean> => {
  const tokens = await getLinkedInTokens(userId);
  return Boolean(tokens?.refresh_token || tokens?.access_token);
};
