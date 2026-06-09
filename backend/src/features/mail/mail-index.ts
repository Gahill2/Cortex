import { listMailAccounts } from "./mail-account-store.js";
import { listInboxMessagesForAccount, type HubMessage } from "./mail-hub.js";
import { prisma } from "../../db/prisma.js";

const activeSyncs = new Set<string>();

function parseMailDate(raw: string): Date {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toHub(row: {
  accountId: string;
  accountEmail: string;
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: Date;
  unread: boolean;
}): HubMessage {
  return {
    id: row.messageId,
    accountId: row.accountId,
    accountEmail: row.accountEmail,
    subject: row.subject,
    from: row.from,
    date: row.date.toISOString(),
    snippet: row.snippet,
    unread: row.unread,
    threadId: row.threadId,
  };
}

async function upsertBatch(userId: string, messages: HubMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  await Promise.all(
    messages.map((m) =>
      prisma.mailMessageIndex.upsert({
        where: {
          userId_accountId_messageId: {
            userId,
            accountId: m.accountId,
            messageId: m.id,
          },
        },
        update: {
          accountEmail: m.accountEmail,
          threadId: m.threadId,
          subject: m.subject,
          from: m.from,
          snippet: m.snippet ?? "",
          date: parseMailDate(m.date),
          unread: m.unread,
          inInbox: true,
          syncedAt: new Date(),
        },
        create: {
          userId,
          accountId: m.accountId,
          accountEmail: m.accountEmail,
          messageId: m.id,
          threadId: m.threadId,
          subject: m.subject,
          from: m.from,
          snippet: m.snippet ?? "",
          date: parseMailDate(m.date),
          unread: m.unread,
          inInbox: true,
        },
      }),
    ),
  );
  return messages.length;
}

async function updateSyncState(
  userId: string,
  patch: Partial<{
    status: string;
    syncedCount: number;
    targetCount: number;
    currentAccount: string | null;
    lastError: string | null;
    lastSyncAt: Date | null;
  }>,
) {
  await prisma.mailSyncState.upsert({
    where: { userId },
    create: {
      userId,
      status: patch.status ?? "idle",
      syncedCount: patch.syncedCount ?? 0,
      targetCount: patch.targetCount ?? 0,
      currentAccount: patch.currentAccount ?? null,
      lastError: patch.lastError ?? null,
      lastSyncAt: patch.lastSyncAt ?? null,
    },
    update: patch,
  });
}

export type MailSyncResult = {
  synced: number;
  accounts: number;
  capped: boolean;
};

export async function getMailSyncState(userId: string) {
  const row = await prisma.mailSyncState.findUnique({ where: { userId } });
  const indexed = await prisma.mailMessageIndex.count({ where: { userId } });
  const unread = await prisma.mailMessageIndex.count({ where: { userId, unread: true } });
  return {
    status: row?.status ?? "idle",
    syncedCount: row?.syncedCount ?? 0,
    targetCount: row?.targetCount ?? 0,
    currentAccount: row?.currentAccount ?? null,
    lastError: row?.lastError ?? null,
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    indexedTotal: indexed,
    unreadTotal: unread,
  };
}

/** Pull inbox metadata from all connected accounts into MailMessageIndex. */
export async function syncMailIndex(
  userId: string,
  opts: { accountId?: string; maxPerAccount?: number; query?: string } = {},
): Promise<MailSyncResult> {
  if (activeSyncs.has(userId)) {
    const state = await getMailSyncState(userId);
    return { synced: state.indexedTotal, accounts: 0, capped: true };
  }

  activeSyncs.add(userId);
  const cap = Math.min(opts.maxPerAccount ?? 5000, 10_000);
  const query = opts.query?.trim() || "in:inbox";
  const accounts = (await listMailAccounts(userId)).filter(
    (a) => !opts.accountId || a.id === opts.accountId,
  );

  let synced = 0;
  let capped = false;

  try {
    await updateSyncState(userId, {
      status: "running",
      syncedCount: 0,
      targetCount: accounts.length * cap,
      currentAccount: null,
      lastError: null,
    });

    for (const account of accounts) {
      await updateSyncState(userId, { currentAccount: account.email });
      const messages = await listInboxMessagesForAccount(userId, account.id, cap, query);
      if (messages.length >= cap) capped = true;

      const BATCH = 40;
      for (let i = 0; i < messages.length; i += BATCH) {
        synced += await upsertBatch(userId, messages.slice(i, i + BATCH));
        await updateSyncState(userId, { syncedCount: synced });
      }
    }

    await updateSyncState(userId, {
      status: "done",
      syncedCount: synced,
      currentAccount: null,
      lastSyncAt: new Date(),
      lastError: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncState(userId, { status: "error", lastError: msg, currentAccount: null });
    throw err;
  } finally {
    activeSyncs.delete(userId);
  }

  return { synced, accounts: accounts.length, capped };
}

export function startMailIndexSync(
  userId: string,
  opts: { accountId?: string; maxPerAccount?: number; query?: string } = {},
): void {
  void syncMailIndex(userId, opts).catch((err) => {
    console.error("[mail-index] sync failed", userId, err);
  });
}

export async function listIndexedInbox(
  userId: string,
  opts: {
    accountId?: string;
    category?: string;
    maxResults?: number;
    unreadOnly?: boolean;
  } = {},
): Promise<{ messages: HubMessage[]; indexed: boolean }> {
  const total = await prisma.mailMessageIndex.count({ where: { userId } });
  if (total === 0) {
    return { messages: [], indexed: false };
  }

  const take = Math.min(opts.maxResults ?? 500, 5000);
  let rows = await prisma.mailMessageIndex.findMany({
    where: {
      userId,
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
      ...(opts.unreadOnly ? { unread: true } : {}),
    },
    orderBy: { date: "desc" },
    take: opts.category ? Math.min(take * 4, 5000) : take,
  });

  if (opts.category) {
    const catRows = await prisma.mailCategory.findMany({
      where: { userId, category: opts.category },
    });
    const keys = new Set(catRows.map((c) => `${c.accountId}:${c.messageId}`));
    rows = rows
      .filter((r: { accountId: string; messageId: string }) =>
        keys.has(`${r.accountId}:${r.messageId}`),
      )
      .slice(0, take);
  }

  return { messages: rows.map(toHub), indexed: true };
}

export async function getMailIndexStats(userId: string) {
  const [total, unread, accounts, categories] = await Promise.all([
    prisma.mailMessageIndex.count({ where: { userId } }),
    prisma.mailMessageIndex.count({ where: { userId, unread: true } }),
    prisma.mailMessageIndex.groupBy({
      by: ["accountId", "accountEmail"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.mailCategory.groupBy({
      by: ["category"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    unread,
    accounts: accounts.map(
      (a: { accountId: string; accountEmail: string; _count: { _all: number } }) => ({
        accountId: a.accountId,
        accountEmail: a.accountEmail,
        count: a._count._all,
      }),
    ),
    categories: Object.fromEntries(
      categories.map((c: { category: string; _count: { _all: number } }) => [
        c.category,
        c._count._all,
      ]),
    ),
  };
}

/** Mark indexed rows archived/read after provider actions. */
export async function patchIndexedMessage(
  userId: string,
  accountId: string,
  messageId: string,
  patch: { unread?: boolean; inInbox?: boolean },
) {
  await prisma.mailMessageIndex.updateMany({
    where: { userId, accountId, messageId },
    data: {
      ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
      ...(patch.inInbox !== undefined ? { inInbox: patch.inInbox } : {}),
    },
  });
}

export async function listIndexedForCleanup(userId: string, cap: number): Promise<HubMessage[]> {
  const rows = await prisma.mailMessageIndex.findMany({
    where: { userId, inInbox: true },
    orderBy: { date: "desc" },
    take: Math.min(cap, 5000),
  });
  return rows.map(toHub);
}
