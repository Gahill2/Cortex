import { prisma } from "../../db/prisma.js";

export interface NotionOAuthTokens {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
}

export const saveNotionTokens = async (userId: string, tokens: NotionOAuthTokens): Promise<void> => {
  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider: "notion" } },
    update: { tokens: JSON.stringify(tokens) },
    create: { userId, provider: "notion", tokens: JSON.stringify(tokens) },
  });
};

export const getNotionTokens = async (userId: string): Promise<NotionOAuthTokens | null> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "notion" } },
  });
  if (!row) return null;
  return JSON.parse(row.tokens) as NotionOAuthTokens;
};

export const clearNotionTokens = async (userId: string): Promise<void> => {
  await prisma.oAuthToken.deleteMany({ where: { userId, provider: "notion" } });
};

export const isNotionUserConnected = async (userId: string): Promise<boolean> => {
  const row = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "notion" } },
  });
  return Boolean(row);
};
