import type { Credentials } from "google-auth-library";
import { prisma } from "../../db/prisma.js";
import { fetchGoogleAccountEmail } from "../gmail/gmail-service.js";
import { getGoogleCredentials } from "../gmail/google-token-store.js";

export type MailProvider = "gmail";

export type MailAccountRow = {
  id: string;
  userId: string;
  provider: MailProvider;
  email: string;
  label: string | null;
  isPrimary: boolean;
  autoOrganize: boolean;
};

export async function listMailAccounts(userId: string): Promise<MailAccountRow[]> {
  try {
    await syncLegacyGoogleToken(userId);
  } catch {
    /* legacy import must not block listing */
  }
  const rows = await prisma.mailAccount.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    provider: r.provider as MailProvider,
    email: r.email,
    label: r.label,
    isPrimary: r.isPrimary,
    autoOrganize: r.autoOrganize
  }));
}

export async function getMailAccountTokens(
  userId: string,
  accountId?: string
): Promise<{ accountId: string; tokens: Credentials } | null> {
  await syncLegacyGoogleToken(userId);

  const row = accountId
    ? await prisma.mailAccount.findFirst({ where: { id: accountId, userId } })
    : await prisma.mailAccount.findFirst({
        where: { userId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      });

  if (!row) return null;
  return { accountId: row.id, tokens: JSON.parse(row.tokens) as Credentials };
}

export async function upsertGmailAccount(
  userId: string,
  email: string,
  tokens: Credentials,
  opts?: { label?: string; isPrimary?: boolean }
): Promise<MailAccountRow> {
  const existing = await prisma.mailAccount.findMany({ where: { userId, provider: "gmail" } });
  const isPrimary = opts?.isPrimary ?? existing.length === 0;

  if (isPrimary) {
    await prisma.mailAccount.updateMany({
      where: { userId, provider: "gmail" },
      data: { isPrimary: false }
    });
  }

  const row = await prisma.mailAccount.upsert({
    where: {
      userId_provider_email: { userId, provider: "gmail", email: email.toLowerCase() }
    },
    update: { tokens: JSON.stringify(tokens), label: opts?.label ?? undefined },
    create: {
      userId,
      provider: "gmail",
      email: email.toLowerCase(),
      label: opts?.label ?? null,
      isPrimary,
      tokens: JSON.stringify(tokens),
      autoOrganize: true
    }
  });

  return {
    id: row.id,
    userId: row.userId,
    provider: "gmail",
    email: row.email,
    label: row.label,
    isPrimary: row.isPrimary,
    autoOrganize: row.autoOrganize
  };
}

export async function removeMailAccount(userId: string, accountId: string): Promise<void> {
  const row = await prisma.mailAccount.findFirst({ where: { id: accountId, userId } });
  if (!row) return;
  await prisma.mailAccount.delete({ where: { id: accountId } });
  if (row.provider === "gmail" && row.isPrimary) {
    const next = await prisma.mailAccount.findFirst({
      where: { userId, provider: "gmail" },
      orderBy: { createdAt: "asc" }
    });
    if (next) {
      await prisma.mailAccount.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }
}

/** Import legacy single Google OAuth row into MailAccount. */
async function syncLegacyGoogleToken(userId: string): Promise<void> {
  const creds = await getGoogleCredentials(userId);
  if (!creds?.access_token && !creds?.refresh_token) return;

  const existing = await prisma.mailAccount.findFirst({
    where: { userId, provider: "gmail" }
  });
  if (existing) return;

  let email: string | null = null;
  try {
    email = await Promise.race([
      fetchGoogleAccountEmail(creds),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000))
    ]);
  } catch {
    email = null;
  }
  await upsertGmailAccount(userId, email ?? `${userId}@gmail.linked`, creds, {
    label: "Gmail",
    isPrimary: true
  });
}
