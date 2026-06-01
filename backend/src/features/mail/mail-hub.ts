import { prisma } from "../../db/prisma.js";
import {
  getGmailMessage,
  listInboxUpTo,
  modifyMessageLabels,
  trashGmailMessage,
  type GmailFullMessage
} from "../gmail/gmail-service.js";
import {
  archiveOutlookMessage,
  deleteOutlookMessage,
  getOutlookMessage,
  listOutlookInboxUpTo,
  markOutlookRead
} from "../microsoft/microsoft-service.js";
import {
  getMailAccountTokens,
  listMailAccounts,
  resolveMailAccountId,
  type MailAccountRow
} from "./mail-account-store.js";

export type HubMessage = {
  id: string;
  accountId: string;
  accountEmail: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  threadId: string;
};

export type HubFullMessage = HubMessage & {
  to: string;
  body: string;
  mimeType?: string;
  labelIds: string[];
};

async function accountRow(userId: string, accountId: string) {
  return prisma.mailAccount.findFirst({ where: { id: accountId, userId } });
}

function toHub(row: MailAccountRow, m: {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  threadId: string;
}): HubMessage {
  return {
    id: m.id,
    accountId: row.id,
    accountEmail: row.email,
    subject: m.subject,
    from: m.from,
    date: m.date,
    snippet: m.snippet,
    unread: m.unread,
    threadId: m.threadId
  };
}

export async function listUnifiedInbox(
  userId: string,
  maxResults: number,
  query?: string
): Promise<{ messages: HubMessage[] }> {
  const accounts = await listMailAccounts(userId);
  const perAccount = Math.max(10, Math.ceil(maxResults / Math.max(accounts.length, 1)));
  const q = query?.trim() || "in:inbox";
  const merged: HubMessage[] = [];

  for (const account of accounts) {
    if (account.provider === "gmail") {
      const tok = await getMailAccountTokens(userId, account.id);
      if (!tok) continue;
      const { messages } = await listInboxUpTo(userId, perAccount, q, tok.tokens, account.id);
      merged.push(...messages.map((m) => toHub(account, m)));
    } else if (account.provider === "microsoft") {
      try {
        const rows = await listOutlookInboxUpTo(userId, account.email, account.id, perAccount);
        merged.push(
          ...rows.map((m) => ({
            id: m.id,
            accountId: m.accountId,
            accountEmail: m.accountEmail,
            subject: m.subject,
            from: m.from,
            date: m.date,
            snippet: m.snippet,
            unread: m.unread,
            threadId: m.threadId
          }))
        );
      } catch {
        /* skip disconnected microsoft */
      }
    }
  }

  merged.sort((a, b) => new Date(b.date).getTime() - new Date(b.date).getTime());
  return { messages: merged.slice(0, maxResults) };
}

export async function listAccountInbox(
  userId: string,
  accountId: string,
  maxResults: number,
  query?: string
): Promise<{ connected: boolean; messages: HubMessage[]; accountId: string }> {
  const account = await accountRow(userId, accountId);
  if (!account) {
    return { connected: false, messages: [], accountId };
  }

  const row: MailAccountRow = {
    id: account.id,
    userId: account.userId,
    provider: account.provider as MailAccountRow["provider"],
    email: account.email,
    label: account.label,
    isPrimary: account.isPrimary,
    autoOrganize: account.autoOrganize
  };

  const q = query?.trim() || (account.provider === "microsoft" ? "" : "in:inbox");

  if (account.provider === "gmail") {
    const tok = await getMailAccountTokens(userId, account.id);
    if (!tok) return { connected: false, messages: [], accountId };
    const { connected, messages } = await listInboxUpTo(userId, maxResults, q, tok.tokens, account.id);
    return {
      connected,
      accountId,
      messages: messages.map((m) => toHub(row, m))
    };
  }

  if (account.provider === "microsoft") {
    try {
      const rows = await listOutlookInboxUpTo(userId, account.email, account.id, maxResults);
      return {
        connected: true,
        accountId,
        messages: rows.map((m) => ({
          id: m.id,
          accountId: m.accountId,
          accountEmail: m.accountEmail,
          subject: m.subject,
          from: m.from,
          date: m.date,
          snippet: m.snippet,
          unread: m.unread,
          threadId: m.threadId
        }))
      };
    } catch {
      return { connected: false, messages: [], accountId };
    }
  }

  return { connected: false, messages: [], accountId };
}

export async function getHubMessage(
  userId: string,
  accountId: string,
  messageId: string
): Promise<HubFullMessage | null> {
  const account = await accountRow(userId, accountId);
  if (!account) return null;

  if (account.provider === "gmail") {
    const tok = await getMailAccountTokens(userId, account.id);
    if (!tok) return null;
    const m = await getGmailMessage(userId, messageId, tok.tokens, account.id);
    if (!m) return null;
    return hubFromGmail(account.id, account.email, m);
  }

  if (account.provider === "microsoft") {
    const m = await getOutlookMessage(userId, account.email, messageId);
    const unread = m.isRead === false;
    return {
      id: m.id,
      accountId: account.id,
      accountEmail: account.email,
      subject: m.subject,
      from: m.from,
      to: m.to,
      date: m.date,
      snippet: (m.body ?? "").slice(0, 200),
      body: m.body,
      mimeType: m.mimeType,
      unread,
      threadId: m.threadId,
      labelIds: m.labelIds ?? []
    };
  }

  return null;
}

function hubFromGmail(accountId: string, accountEmail: string, m: GmailFullMessage): HubFullMessage {
  return {
    id: m.id,
    accountId,
    accountEmail,
    subject: m.subject,
    from: m.from,
    to: m.to,
    date: m.date,
    snippet: m.snippet,
    body: m.body,
    mimeType: m.mimeType,
    unread: m.unread,
    threadId: m.threadId,
    labelIds: m.labelIds
  };
}

export async function patchHubMessage(
  userId: string,
  accountId: string,
  messageId: string,
  patch: { read?: boolean; archived?: boolean }
): Promise<void> {
  const resolvedId = (await resolveMailAccountId(userId, accountId)) ?? accountId;
  const account = await accountRow(userId, resolvedId);
  if (!account) throw new Error("Account not found");

  if (account.provider === "gmail") {
    const tok = await getMailAccountTokens(userId, account.id);
    if (!tok) throw new Error("Gmail not connected");
    const creds = tok.tokens;
    if (patch.read === true) {
      await modifyMessageLabels(
        userId,
        messageId,
        { removeLabelIds: ["UNREAD"] },
        creds,
        account.id
      );
    }
    if (patch.archived === true) {
      await modifyMessageLabels(
        userId,
        messageId,
        { removeLabelIds: ["INBOX"] },
        creds,
        account.id
      );
    }
    return;
  }

  if (account.provider === "microsoft") {
    if (patch.read === true) {
      await markOutlookRead(userId, account.email, messageId);
    }
    if (patch.archived === true) {
      await archiveOutlookMessage(userId, account.email, messageId);
    }
  }
}

export async function deleteHubMessages(
  userId: string,
  items: Array<{ accountId: string; messageId: string }>
): Promise<{ deleted: number; failed: number; lastError?: string }> {
  let deleted = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const { accountId, messageId } of items) {
    try {
      const resolvedId = (await resolveMailAccountId(userId, accountId)) ?? accountId;
      const account = await accountRow(userId, resolvedId);
      if (!account) {
        failed++;
        lastError = "Mail account not found — try reconnecting Gmail/Outlook.";
        continue;
      }
      if (account.provider === "gmail") {
        const tok = await getMailAccountTokens(userId, account.id);
        if (!tok) {
          failed++;
          lastError = "Gmail not connected for this account.";
          continue;
        }
        await trashGmailMessage(userId, messageId, tok.tokens, account.id);
        deleted++;
      } else if (account.provider === "microsoft") {
        await deleteOutlookMessage(userId, account.email, messageId);
        deleted++;
      } else {
        failed++;
        lastError = "Delete is not supported for this mail provider.";
      }
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { deleted, failed, lastError };
}

export async function listInboxMessagesForAccount(
  userId: string,
  accountId: string | undefined,
  cap: number,
  query: string
): Promise<HubMessage[]> {
  const accounts = accountId
    ? (await listMailAccounts(userId)).filter((a) => a.id === accountId)
    : await listMailAccounts(userId);

  const out: HubMessage[] = [];

  for (const account of accounts) {
    if (account.provider === "gmail") {
      const tok = await getMailAccountTokens(userId, account.id);
      if (!tok) continue;
      const { messages } = await listInboxUpTo(userId, cap, query, tok.tokens, account.id);
      out.push(...messages.map((m) => toHub(account, m)));
    } else if (account.provider === "microsoft") {
      try {
        const rows = await listOutlookInboxUpTo(userId, account.email, account.id, cap);
        out.push(
          ...rows.map((m) => ({
            id: m.id,
            accountId: m.accountId,
            accountEmail: m.accountEmail,
            subject: m.subject,
            from: m.from,
            date: m.date,
            snippet: m.snippet,
            unread: m.unread,
            threadId: m.threadId
          }))
        );
      } catch {
        /* skip */
      }
    }
    if (out.length >= cap) break;
  }

  return out.slice(0, cap);
}

/** Fetch up to `cap` inbox messages across one or all accounts (paginated per provider). */
export async function listDeepInbox(
  userId: string,
  accountId: string | undefined,
  cap: number,
  query = "in:inbox"
): Promise<HubMessage[]> {
  return listInboxMessagesForAccount(userId, accountId, cap, query);
}
