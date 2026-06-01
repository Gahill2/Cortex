import { callAI, getAIStatus, isAiBillingError } from "../ai/ai-provider.js";
import { extractJsonObject } from "./mail-classify.js";
import { listDeepInbox, type HubMessage } from "./mail-hub.js";
import { prisma } from "../../db/prisma.js";

export type MailTrendPoint = { label: string; count: number };
export type MailSenderStat = { sender: string; count: number; category?: string };
export type MailWatchItem = {
  messageId: string;
  accountId: string;
  subject: string;
  from: string;
  reason: string;
  urgency: "high" | "medium" | "low";
};

export type MailInsightsResult = {
  scanned: number;
  categorized: number;
  stats: {
    unread: number;
    byCategory: Record<string, number>;
    topSenders: MailSenderStat[];
    volumeByDay: MailTrendPoint[];
    newsletterShare: number;
  };
  watchlist: MailWatchItem[];
  trendsSummary: string | null;
  aiMode: "ai" | "rules" | "none";
  aiWarning?: string;
};

function senderKey(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m?.[1] ?? from).trim().toLowerCase() || "unknown";
}

function senderLabel(from: string): string {
  const name = from.split("<")[0].trim();
  return name || from;
}

function buildLocalStats(messages: HubMessage[], byCategory: Record<string, number>) {
  const unread = messages.filter((m) => m.unread).length;
  const senderCounts = new Map<string, { label: string; count: number }>();
  const dayCounts = new Map<string, number>();

  for (const m of messages) {
    const key = senderKey(m.from);
    const prev = senderCounts.get(key) ?? { label: senderLabel(m.from), count: 0 };
    prev.count++;
    senderCounts.set(key, prev);

    const d = m.date ? new Date(m.date) : null;
    if (d && !Number.isNaN(d.getTime())) {
      const day = d.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }

  const topSenders: MailSenderStat[] = [...senderCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([_, v]) => ({ sender: v.label, count: v.count }));

  const volumeByDay: MailTrendPoint[] = [...dayCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([label, count]) => ({ label, count }));

  const newsletterShare =
    messages.length > 0 ? Math.round(((byCategory.newsletters ?? 0) / messages.length) * 100) : 0;

  return { unread, topSenders, volumeByDay, newsletterShare };
}

export async function generateMailInsights(
  userId: string,
  opts: { accountId?: string; maxMessages?: number } = {}
): Promise<MailInsightsResult> {
  const cap = Math.min(opts.maxMessages ?? 500, 2000);
  const messages = await listDeepInbox(userId, opts.accountId, cap);
  const catRows = await prisma.mailCategory.findMany({ where: { userId } });
  const byCategory: Record<string, number> = {};
  for (const r of catRows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }

  const stats = buildLocalStats(messages, byCategory);
  const status = await getAIStatus();
  const aiAvailable = status.kimi || status.anthropic || status.openai;

  if (!aiAvailable || messages.length === 0) {
    return {
      scanned: messages.length,
      categorized: catRows.length,
      stats: { byCategory, ...stats },
      watchlist: [],
      trendsSummary: null,
      aiMode: "none",
      aiWarning: !aiAvailable
        ? "AI unavailable — add Anthropic API credits (console.anthropic.com) or OPENAI_API_KEY. Claude Pro subscription does not power Cortex API."
        : undefined,
    };
  }

  const sample = messages.slice(0, 60);
  const importantCandidates = sample.filter((m) => {
    const hay = `${m.from} ${m.subject} ${m.snippet}`.toLowerCase();
    return m.unread || /\b(urgent|invoice|payment|deadline|security|verify|action required|interview|offer)\b/.test(hay);
  }).slice(0, 25);

  const senderSummary = stats.topSenders.slice(0, 8).map((s) => `${s.sender} (${s.count})`).join(", ");
  const categorySummary = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Analyze this mailbox snapshot for the user.

Top senders: ${senderSummary || "none"}
Category counts: ${categorySummary || "none yet"}
Unread in sample: ${stats.unread} of ${sample.length}
Newsletter share: ${stats.newsletterShare}%

Candidate important messages:
${importantCandidates.map((m, i) => `${i + 1}. id="${m.id}" accountId="${m.accountId}" from="${m.from}" subject="${m.subject}" snippet="${m.snippet.slice(0, 120)}"`).join("\n")}

Return ONLY JSON:
{
  "trendsSummary": "2-4 sentences on inbox patterns, what dominates, cleanup opportunity",
  "watchlist": [
    {"id":"...","accountId":"...","reason":"why it matters","urgency":"high"|"medium"|"low"}
  ]
}
Include up to 8 watchlist items — bills, deadlines, security, human replies. Skip obvious promos.`;

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", preferCloud: true, maxTokens: 2000, systemPrompt: "Return only valid JSON." }
    );
    const parsed = extractJsonObject(result.text) as {
      trendsSummary?: string;
      watchlist?: Array<{ id?: string; accountId?: string; reason?: string; urgency?: string }>;
    } | null;

    const watchlist: MailWatchItem[] = [];
    for (const row of parsed?.watchlist ?? []) {
      const id = String(row.id ?? "").trim();
      const accountId = String(row.accountId ?? "").trim();
      const src = sample.find((m) => m.id === id && (!accountId || m.accountId === accountId));
      if (!src) continue;
      const urgencyRaw = String(row.urgency ?? "medium");
      const urgency = urgencyRaw === "high" || urgencyRaw === "low" ? urgencyRaw : "medium";
      watchlist.push({
        messageId: src.id,
        accountId: src.accountId,
        subject: src.subject,
        from: src.from,
        reason: String(row.reason ?? "May need attention").slice(0, 200),
        urgency,
      });
    }

    return {
      scanned: messages.length,
      categorized: catRows.length,
      stats: { byCategory, ...stats },
      watchlist,
      trendsSummary: parsed?.trendsSummary?.trim() ?? null,
      aiMode: "ai",
    };
  } catch (err) {
    return {
      scanned: messages.length,
      categorized: catRows.length,
      stats: { byCategory, ...stats },
      watchlist: [],
      trendsSummary: null,
      aiMode: "rules",
      aiWarning: isAiBillingError(err)
        ? "Anthropic API credits exhausted. Claude Pro does not include API access — add credits at console.anthropic.com or set OPENAI_API_KEY."
        : err instanceof Error
          ? err.message
          : "AI insights unavailable",
    };
  }
}
