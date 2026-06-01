import { callAI, getAIStatus, isAiBillingError } from "../ai/ai-provider.js";
import { mergeMailCategories, extractJsonArray } from "./mail-classify.js";
import { listDeepInbox, type HubMessage } from "./mail-hub.js";
import { prisma } from "../../db/prisma.js";

const CATEGORIES = ["work", "school", "personal", "social", "media", "finance", "newsletters", "important", "other"] as const;

export type CategorizeAllResult = {
  fetched: number;
  categorized: number;
  batches: number;
  mode: "ai+rules" | "rules";
  aiWarning?: string;
};

async function categorizeBatch(
  userId: string,
  messages: HubMessage[],
  rulesOnly: boolean
): Promise<number> {
  if (messages.length === 0) return 0;

  let aiRows: Array<{ id?: unknown; category?: unknown; summary?: unknown }> = [];

  if (!rulesOnly) {
    const emailList = messages
      .map(
        (m, i) =>
          `${i + 1}. id="${m.id}" accountId="${m.accountId}" from="${m.from}" subject="${m.subject}" snippet="${m.snippet?.slice(0, 120) ?? ""}"`
      )
      .join("\n");

    const prompt = `Categorize each email into exactly one category from: work, school, personal, social, media, finance, newsletters, important, other.
Also write a 1-sentence summary (max 15 words) for each.

Return ONLY a JSON array, no prose, no markdown fences. Include every id listed below exactly once.
[{"id":"...","accountId":"...","category":"...","summary":"..."}]

Emails:
${emailList}`;

    try {
      const result = await callAI(
        [{ role: "user", content: prompt }],
        { tier: "simple", preferCloud: true, maxTokens: 4000, systemPrompt: "You are an email classifier. Return only valid JSON." }
      );
      const parsed = extractJsonArray(result.text);
      if (parsed) aiRows = parsed as typeof aiRows;
    } catch {
      /* heuristics fill gaps */
    }
  }

  const payload = messages.map((m) => ({
    id: m.id,
    accountId: m.accountId,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
  }));

  const categories = mergeMailCategories(payload, aiRows, CATEGORIES);

  await Promise.all(
    categories.map((c) =>
      prisma.mailCategory.upsert({
        where: {
          userId_accountId_messageId: {
            userId,
            accountId: c.accountId,
            messageId: c.id,
          },
        },
        update: { category: c.category, summary: c.summary },
        create: {
          userId,
          accountId: c.accountId,
          messageId: c.id,
          category: c.category,
          summary: c.summary,
        },
      })
    )
  );

  return categories.length;
}

export async function categorizeAllMail(
  userId: string,
  opts: { accountId?: string; maxMessages?: number } = {}
): Promise<CategorizeAllResult> {
  const cap = Math.min(opts.maxMessages ?? 1000, 2000);
  const messages = await listDeepInbox(userId, opts.accountId, cap);
  const status = await getAIStatus();
  const rulesOnly = !(status.kimi || status.anthropic || status.openai);

  const BATCH = 80;
  let categorized = 0;
  let batches = 0;
  let aiWarning: string | undefined;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      categorized += await categorizeBatch(userId, batch, rulesOnly);
      batches++;
    } catch (err) {
      if (isAiBillingError(err)) {
        aiWarning =
          "Anthropic API credits exhausted. Claude Pro does not include API access — add credits at console.anthropic.com or set OPENAI_API_KEY.";
        categorized += await categorizeBatch(userId, batch, true);
        batches++;
      } else {
        throw err;
      }
    }
  }

  return {
    fetched: messages.length,
    categorized,
    batches,
    mode: rulesOnly || aiWarning ? "rules" : "ai+rules",
    aiWarning,
  };
}
