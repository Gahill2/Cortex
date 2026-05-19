import { prisma } from "../../db/prisma.js";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const saveSpotifyTokens = async (userId: string, tokens: SpotifyTokens): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "spotify" } },
    update: { tokens: JSON.stringify(tokens) },
    create: { userId, provider: "spotify", tokens: JSON.stringify(tokens) },
  });
};

export const getSpotifyTokens = async (userId: string): Promise<SpotifyTokens | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "spotify" } },
  });
  if (!row) return null;
  return JSON.parse(row.tokens) as SpotifyTokens;
};

export const clearSpotifyTokens = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "spotify" } });
};

export const isSpotifyConnected = async (userId: string): Promise<boolean> => {
  const tokens = await getSpotifyTokens(userId);
  return Boolean(tokens?.refresh_token || tokens?.access_token);
};
