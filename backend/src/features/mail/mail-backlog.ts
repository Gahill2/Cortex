import { categorizeAllMail } from "./mail-sync.js";
import {
  applyCleanupActions,
  applyMailboxOrganize,
  scanMailCleanup,
  scanIndexedMailCleanup,
} from "./mail-cleanup.js";
import {
  getMailIndexStats,
  getMailSyncState,
  listIndexedForCleanup,
  startMailIndexSync,
  syncMailIndex,
} from "./mail-index.js";
import { listMailAccounts } from "./mail-account-store.js";
import { patchHubMessage } from "./mail-hub.js";
import { prisma } from "../../db/prisma.js";

const NEWSLETTER_CATEGORIES = new Set(["newsletters", "social", "media"]);

export type BacklogClearResult = {
  sync: { synced: number; accounts: number; capped: boolean };
  categorize: Awaited<ReturnType<typeof categorizeAllMail>>;
  archived: Awaited<ReturnType<typeof applyMailboxOrganize>>;
  cleanup: { scanned: number; applied: number; deleted: number; archived: number; failed: number };
  markedRead: number;
};

/** Full pipeline: sync → categorize → archive low-value → cleanup high-confidence junk. */
export async function clearMailBacklog(
  userId: string,
  opts: {
    accountId?: string;
    maxMessages?: number;
    applyDeletes?: boolean;
  } = {},
): Promise<BacklogClearResult> {
  const cap = Math.min(opts.maxMessages ?? 5000, 10_000);

  const sync = await syncMailIndex(userId, {
    accountId: opts.accountId,
    maxPerAccount: cap,
  });

  const categorize = await categorizeAllMail(userId, {
    accountId: opts.accountId,
    maxMessages: cap,
  });

  const archived = await applyMailboxOrganize(userId, opts.accountId);

  let markedRead = 0;
  const newsletterRows = await prisma.mailCategory.findMany({
    where: {
      userId,
      category: { in: [...NEWSLETTER_CATEGORIES] },
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
    },
    take: 500,
  });

  for (const row of newsletterRows) {
    try {
      await patchHubMessage(userId, row.accountId, row.messageId, { read: true });
      markedRead++;
    } catch {
      /* skip disconnected */
    }
  }

  const indexed = await listIndexedForCleanup(userId, cap);
  const scan =
    indexed.length > 0
      ? await scanIndexedMailCleanup(userId, { maxMessages: cap })
      : await scanMailCleanup(userId, {
          accountId: opts.accountId,
          maxMessages: cap,
        });

  const toApply = opts.applyDeletes !== false
    ? scan.suggestions.filter((s) => s.confidence === "high" || s.confidence === "medium")
    : scan.suggestions.filter((s) => s.confidence === "high");

  let deleted = 0;
  let archivedCleanup = 0;
  let failed = 0;

  if (toApply.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < toApply.length; i += CHUNK) {
      const chunk = toApply.slice(i, i + CHUNK).map((s) => ({
        accountId: s.accountId,
        messageId: s.messageId,
        action: s.action as "delete" | "archive",
      }));
      const r = await applyCleanupActions(userId, chunk);
      deleted += r.deleted;
      archivedCleanup += r.archived;
      failed += r.failed;
    }
  }

  return {
    sync,
    categorize,
    archived,
    cleanup: {
      scanned: scan.scanned,
      applied: toApply.length,
      deleted,
      archived: archivedCleanup,
      failed,
    },
    markedRead,
  };
}

export async function getBacklogOverview(userId: string) {
  const [syncState, stats, accounts] = await Promise.all([
    getMailSyncState(userId),
    getMailIndexStats(userId),
    listMailAccounts(userId),
  ]);
  return {
    accounts: accounts.length,
    sync: syncState,
    stats,
  };
}

export { startMailIndexSync, getMailSyncState, getMailIndexStats };
