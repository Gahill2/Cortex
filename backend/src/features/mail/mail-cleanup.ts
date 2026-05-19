import { callAI, getAIStatus } from "../ai/ai-provider.js";
import { extractJsonArray } from "./mail-classify.js";
import {
  deleteHubMessages,
  listInboxMessagesForAccount,
  patchHubMessage,
  type HubMessage
} from "./mail-hub.js";
import { listMailAccounts, resolveMailAccountId } from "./mail-account-store.js";
import { prisma } from "../../db/prisma.js";

function matchMessageFromAiRow(
  row: Record<string, unknown>,
  messages: HubMessage[],
  sample: HubMessage[]
): HubMessage | null {
  const rawId = String(row.id ?? row.messageId ?? "").trim();
  let accountId = String(row.accountId ?? row.account_id ?? "").trim();

  if (/^\d+$/.test(rawId)) {
    const idx = parseInt(rawId, 10) - 1;
    if (idx >= 0 && idx < sample.length) return sample[idx];
  }

  if (rawId) {
    if (accountId) {
      const exact = messages.find((m) => m.id === rawId && m.accountId === accountId);
      if (exact) return exact;
      if (accountId.includes("@")) {
        const byEmail = messages.find(
          (m) => m.id === rawId && m.accountEmail.toLowerCase() === accountId.toLowerCase()
        );
        if (byEmail) return byEmail;
      }
    }
    const byId = messages.find((m) => m.id === rawId);
    if (byId) return byId;
  }

  return null;
}

export type CleanupSuggestion = {
  messageId: string;
  accountId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  action: "delete" | "archive" | "keep";
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type CleanupScanResult = {
  scanned: number;
  suggestions: CleanupSuggestion[];
  mode: "ai" | "rules";
};

const ARCHIVE_CATEGORIES = new Set(["newsletters", "social", "media"]);

const NEWSLETTER = /\b(newsletter|unsubscribe|list-unsubscribe|no-?reply|promo|sale|\d+% off)\b/i;

function ruleSuggestions(messages: HubMessage[]): CleanupSuggestion[] {
  return messages.map((m) => {
    const hay = `${m.from} ${m.subject} ${m.snippet}`;
    if (NEWSLETTER.test(hay)) {
      return {
        messageId: m.id,
        accountId: m.accountId,
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
        date: m.date,
        action: "delete" as const,
        reason: "Looks like marketing or newsletter mail",
        confidence: "medium" as const
      };
    }
    return {
      messageId: m.id,
      accountId: m.accountId,
      from: m.from,
      subject: m.subject,
      snippet: m.snippet,
      date: m.date,
      action: "keep" as const,
      reason: "No cleanup rule matched",
      confidence: "low" as const
    };
  }).filter((s) => s.action !== "keep");
}

export async function scanMailCleanup(
  userId: string,
  opts: { accountId?: string; maxMessages?: number; query?: string }
): Promise<CleanupScanResult> {
  const cap = Math.min(opts.maxMessages ?? 200, 500);
  const query = opts.query?.trim() || "in:inbox";
  const messages = await listInboxMessagesForAccount(userId, opts.accountId, cap, query);

  if (messages.length === 0) {
    return { scanned: 0, suggestions: [], mode: "rules" };
  }

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    const suggestions = ruleSuggestions(messages);
    return { scanned: messages.length, suggestions, mode: "rules" };
  }

  const sample = messages.slice(0, 80);
  const emailList = sample
    .map(
      (m, i) =>
        `${i + 1}. id="${m.id}" accountId="${m.accountId}" from="${m.from}" subject="${m.subject}" snippet="${m.snippet.slice(0, 100)}"`
    )
    .join("\n");

  const prompt = `You help clear an email backlog. For each message, suggest one action:
- "delete" — safe to trash (old promos, duplicates, obvious spam, expired notifications)
- "archive" — low value but not trash (FYI newsletters already read, old receipts)
- "keep" — personal, financial, legal, or might still matter

Return ONLY a JSON array (no markdown). Each item:
{"id":"...","accountId":"...","action":"delete"|"archive"|"keep","reason":"short","confidence":"high"|"medium"|"low"}

Be conservative: when unsure, use "keep".

Emails:
${emailList}`;

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", maxTokens: 4000, systemPrompt: "Return only valid JSON arrays." }
    );
    const parsed = extractJsonArray(result.text);
    if (!parsed?.length) {
      const suggestions = ruleSuggestions(messages);
      return { scanned: messages.length, suggestions, mode: "rules" };
    }

    const byKey = new Map<string, CleanupSuggestion>();
    for (const row of parsed) {
      const r = row as Record<string, unknown>;
      const actionRaw = r.action != null ? String(r.action) : "keep";
      const action =
        actionRaw === "delete" || actionRaw === "archive" || actionRaw === "keep" ? actionRaw : "keep";
      if (action === "keep") continue;

      const src = matchMessageFromAiRow(r, messages, sample);
      if (!src) continue;
      const id = src.id;
      const accountId = src.accountId;
      const confRaw = r.confidence != null ? String(r.confidence) : "medium";
      const confidence =
        confRaw === "high" || confRaw === "medium" || confRaw === "low" ? confRaw : "medium";
      byKey.set(`${accountId}:${id}`, {
        messageId: id,
        accountId,
        from: src.from,
        subject: src.subject,
        snippet: src.snippet,
        date: src.date,
        action,
        reason: r.reason != null ? String(r.reason).slice(0, 200) : "Suggested by AI",
        confidence
      });
    }

    const suggestions = [...byKey.values()];
    if (suggestions.length === 0) {
      return { scanned: messages.length, suggestions: ruleSuggestions(messages), mode: "rules" };
    }
    return { scanned: messages.length, suggestions, mode: "ai" };
  } catch {
    return { scanned: messages.length, suggestions: ruleSuggestions(messages), mode: "rules" };
  }
}

export async function applyMailboxOrganize(
  userId: string,
  accountId?: string
): Promise<{ archived: number; markedRead: number; categorized: number; failed: number }> {
  const categories = await prisma.mailCategory.findMany({
    where: {
      userId,
      category: { in: [...ARCHIVE_CATEGORIES] }
    }
  });

  const accounts = await listMailAccounts(userId);
  let archived = 0;
  let failed = 0;

  for (const row of categories) {
    const stored = row.accountId?.trim() ?? "";
    const candidates = stored
      ? accountId && stored !== accountId
        ? []
        : [stored]
      : accounts.map((a) => a.id).filter((id) => !accountId || id === accountId);

    if (candidates.length === 0) {
      failed++;
      continue;
    }

    let done = false;
    for (const accId of candidates) {
      try {
        await patchHubMessage(userId, accId, row.messageId, { archived: true });
        archived++;
        done = true;
        break;
      } catch (err) {
        console.warn("[mail] archive failed", row.messageId, accId, err);
      }
    }
    if (!done) failed++;
  }

  const total = await prisma.mailCategory.count({ where: { userId } });
  return { archived, markedRead: 0, categorized: total, failed };
}

export type CleanupApplyItemResult = {
  accountId: string;
  messageId: string;
  action: "delete" | "archive";
  ok: boolean;
  error?: string;
};

export async function applyCleanupActions(
  userId: string,
  items: Array<{ accountId: string; messageId: string; action: "delete" | "archive" }>
): Promise<{
  deleted: number;
  archived: number;
  failed: number;
  errors: string[];
  results: CleanupApplyItemResult[];
}> {
  let deleted = 0;
  let archived = 0;
  let failed = 0;
  const errors: string[] = [];
  const results: CleanupApplyItemResult[] = [];

  for (const item of items) {
    try {
      const accountId = (await resolveMailAccountId(userId, item.accountId)) ?? item.accountId;
      const normalized = { ...item, accountId };

      if (item.action === "delete") {
        const r = await deleteHubMessages(userId, [
          { accountId: normalized.accountId, messageId: normalized.messageId },
        ]);
        if (r.deleted > 0) {
          deleted++;
          results.push({ ...normalized, ok: true });
        } else {
          failed++;
          const err =
            r.lastError ??
            "Could not delete — reconnect Gmail/Outlook with mail permissions (gmail.modify).";
          if (!errors.includes(err)) errors.push(err);
          results.push({ ...normalized, ok: false, error: err });
        }
      } else {
        await patchHubMessage(userId, normalized.accountId, normalized.messageId, { archived: true });
        archived++;
        results.push({ ...normalized, ok: true });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      if (!errors.includes(msg)) errors.push(msg);
      console.warn("[mail] cleanup apply failed", item.accountId, item.messageId, err);
      results.push({ ...item, ok: false, error: msg });
    }
  }

  return { deleted, archived, failed, errors, results };
}
