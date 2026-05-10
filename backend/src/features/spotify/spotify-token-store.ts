import { prisma } from "../../db/prisma.js";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const saveSpotifyTokens = async (userId: string, tokens: SpotifyTokens): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "spotify" } },
    update: { tokens: tokens as object },
    create: { userId, provider: "spotify", tokens: tokens as object },
  });
};

export const getSpotifyTokens = async (userId: string): Promise<SpotifyTokens | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "spotify" } },
  });
  return row ? (row.tokens as SpotifyTokens) : null;
};

export const clearSpotifyTokens = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "spotify" } });
};

export const isSpotifyConnected = async (userId: string): Promise<boolean> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "spotify" } },
  });
  return Boolean(row);
};
