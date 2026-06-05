import { callAI, getAIStatus } from "../ai/ai-provider.js";
import { extractJsonArray } from "./mail-classify.js";
import { listInboxUpTo, modifyMessageLabels, type InboxRow } from "../gmail/gmail-service.js";
import { getMailAccountTokens } from "./mail-account-store.js";

export type OrganizeAction = {
  messageId: string;
  action: "archive" | "mark_read" | "keep";
  reason: string;
};

export type OrganizeResult = {
  scanned: number;
  archived: number;
  markedRead: number;
  actions: OrganizeAction[];
};

const NEWSLETTER_HINTS = /unsubscribe|newsletter|no-reply|noreply|marketing/i;

function ruleBasedOrganize(messages: InboxRow[]): OrganizeAction[] {
  return messages
    .filter((m) => m.unread)
    .slice(0, 25)
    .map((m) => {
      const hay = `${m.subject} ${m.snippet} ${m.from}`;
      if (NEWSLETTER_HINTS.test(hay)) {
        return { messageId: m.id, action: "archive" as const, reason: "Likely newsletter / bulk" };
      }
      return { messageId: m.id, action: "keep" as const, reason: "No rule matched" };
    })
    .filter((a) => a.action !== "keep");
}

async function aiOrganize(messages: InboxRow[]): Promise<OrganizeAction[]> {
  const sample = messages.filter((m) => m.unread).slice(0, 25);
  const payload = sample.map((m) => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet.slice(0, 120)
  }));

  const status = await getAIStatus();
  if (status.activeProvider === "none") return ruleBasedOrganize(messages);

  try {
    const result = await callAI(
      [{ role: "user", content: JSON.stringify(payload) }],
      {
        tier: "simple",
        maxTokens: 1200,
        systemPrompt:
          'Triage email. Return ONLY a JSON array: [{"id":"...","action":"archive"|"mark_read"|"keep","reason":"..."}]. Archive promos/newsletters; mark_read low-priority FYIs; keep personal/urgent.'
      }
    );
    const parsed = extractJsonArray(result.text);
    if (!parsed) return ruleBasedOrganize(messages);
    return parsed
      .map((row) => {
        const r = row as Record<string, unknown>;
        const id = r.id != null ? String(r.id) : "";
        const action = r.action != null ? String(r.action) : "keep";
        const reason = r.reason != null ? String(r.reason) : "";
        if (!id || !["archive", "mark_read", "keep"].includes(action)) return null;
        return { messageId: id, action: action as OrganizeAction["action"], reason };
      })
      .filter((a): a is OrganizeAction => a !== null);
  } catch {
    return ruleBasedOrganize(messages);
  }
}

export async function organizeInbox(
  userId: string,
  accountId?: string
): Promise<OrganizeResult> {
  const account = await getMailAccountTokens(userId, accountId);
  if (!account) {
    return { scanned: 0, archived: 0, markedRead: 0, actions: [] };
  }

  const { messages } = await listInboxUpTo(userId, 80, "in:inbox is:unread", account.tokens);
  const unread = messages.filter((m) => m.unread);
  const plan = unread.length > 0 ? await aiOrganize(messages) : ruleBasedOrganize(messages);

  let archived = 0;
  let markedRead = 0;

  for (const step of plan) {
    if (step.action === "archive") {
      await modifyMessageLabels(userId, step.messageId, { removeLabelIds: ["INBOX"] }, account.tokens);
      archived++;
    } else if (step.action === "mark_read") {
      await modifyMessageLabels(userId, step.messageId, { removeLabelIds: ["UNREAD"] }, account.tokens);
      markedRead++;
    }
  }

  return {
    scanned: unread.length,
    archived,
    markedRead,
    actions: plan
  };
}
