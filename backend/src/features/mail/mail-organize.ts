import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { listInbox, modifyMessageLabels, type InboxRow } from "../gmail/gmail-service.js";
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
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const sample = messages.filter((m) => m.unread).slice(0, 15);
  const payload = sample.map((m) => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet.slice(0, 120)
  }));

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system:
      "You triage email. Return ONLY valid JSON array: [{\"id\",\"action\":\"archive\"|\"mark_read\"|\"keep\",\"reason\"}]. Archive promos/newsletters; mark_read low-priority FYIs; keep personal/urgent.",
    messages: [{ role: "user", content: JSON.stringify(payload) }]
  });

  const text = (msg.content[0] as { type: "text"; text: string }).text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return ruleBasedOrganize(messages);
  try {
    const parsed = JSON.parse(match[0]) as OrganizeAction[];
    return parsed.filter((a) => a.messageId && ["archive", "mark_read", "keep"].includes(a.action));
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

  const { messages } = await listInbox(userId, 30, "in:inbox is:unread", account.tokens);
  const unread = messages.filter((m) => m.unread);
  const plan =
    env.ANTHROPIC_API_KEY && unread.length > 0
      ? await aiOrganize(messages)
      : ruleBasedOrganize(messages);

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
