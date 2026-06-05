import { prisma } from "../../db/prisma.js";

export interface CanvaTokens {
  access_token: string;
  refresh_token: string;
  /** Epoch ms when access_token should be refreshed */
  expires_at: number;
  scope?: string;
}

export const saveCanvaTokens = async (userId: string, tokens: CanvaTokens): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "canva" } },
    update: { tokens: JSON.stringify(tokens) },
    create: { userId, provider: "canva", tokens: JSON.stringify(tokens) },
  });
};

export const getCanvaTokens = async (userId: string): Promise<CanvaTokens | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "canva" } },
  });
  if (!row) return null;
  return JSON.parse(row.tokens) as CanvaTokens;
};

export const clearCanvaTokens = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "canva" } });
};

export const isCanvaConnected = async (userId: string): Promise<boolean> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "canva" } },
  });
  return Boolean(row);
};
