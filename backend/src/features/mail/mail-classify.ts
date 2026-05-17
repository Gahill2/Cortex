/**
 * Rule-based email buckets used when AI is off or returns incomplete / invalid JSON.
 */

export type MailCategory =
  | "work"
  | "school"
  | "personal"
  | "social"
  | "media"
  | "finance"
  | "newsletters"
  | "important"
  | "other";

const FINANCE = /\b(invoice|payment due|payment received|receipt|bank statement|direct debit|wire transfer|tax return|1099|stripe|paypal|venmo|credit limit|transaction alert|your bill is|autopay)\b/i;

const NEWSLETTER =
  /\b(newsletter|list-unsubscribe|unsubscribe|daily digest|weekly digest|substack|mailchimp|beehiiv|morning brew|promotions hub|you'?re subscribed)\b/i;

const SOCIAL = /\b(facebook|linkedin notification|instagram|twitter\.com|\bx\b\.com\/|discord|slack invitation|invited you to connect)\b/i;

const MEDIA = /\b(youtube|netflix|hulu|spotify|twitch|prime video|disney\+|hbo)\b/i;

const SCHOOL = /\.edu\b|\b(canvas|blackboard|schoology|google classroom|student portal|course registration|syllabus)\b/i;

const IMPORTANT =
  /\b(urgent|action required|security alert|verify your (email|account)|password reset|two[- ]factor|2fa code|sign[- ]in (attempt|alert)|unusual activity)\b/i;

/** Weak “probably work” signal — calendar / conferencing from non-consumer domains */
const WORK_MEETING =
  /\b(calendar invite|new event:|accepted:|declined:|teams\.microsoft|zoom\.us\/|meet\.google\.com\/)\b/i;

export function heuristicMailCategory(from: string, subject: string, snippet: string): MailCategory {
  const blob = `${from}\n${subject}\n${snippet}`.toLowerCase();

  if (IMPORTANT.test(blob)) return "important";
  if (FINANCE.test(blob)) return "finance";
  if (NEWSLETTER.test(blob) || (/no-?reply/.test(from.toLowerCase()) && /\b(sale|\d+% off|limited time|shop now)\b/i.test(blob))) {
    return "newsletters";
  }
  if (SOCIAL.test(blob)) return "social";
  if (MEDIA.test(blob)) return "media";
  if (SCHOOL.test(blob)) return "school";
  if (WORK_MEETING.test(blob)) return "work";

  const fromLower = from.toLowerCase();
  if (/@[a-z0-9.-]+\.(gov|mil)\b/.test(fromLower)) return "work";

  return "other";
}

export function shortSubjectSummary(subject: string): string {
  const s = subject.trim() || "(no subject)";
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

/** Pull a JSON array from model output (handles prose + markdown fences). */
export function extractJsonArray(text: string): unknown[] | null {
  let t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```/im.exec(t);
  if (fenced) t = fenced[1].trim();

  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeMailCategories(
  messages: Array<{ id: string; from: string; subject: string; snippet?: string }>,
  aiRows: Array<{ id?: unknown; category?: unknown; summary?: unknown }>,
  validCategories: readonly string[]
): Array<{ id: string; category: MailCategory; summary: string }> {
  const norm = (s: string) => s.trim();
  const byId = new Map<string, { category: MailCategory; summary: string }>();

  for (const row of aiRows) {
    const id = row.id != null ? norm(String(row.id)) : "";
    if (!id) continue;
    const rawCat = row.category != null ? String(row.category).trim().toLowerCase() : "";
    const cat = validCategories.includes(rawCat) ? (rawCat as MailCategory) : null;
    if (!cat) continue;
    const summary =
      row.summary != null && String(row.summary).trim()
        ? String(row.summary).trim().slice(0, 500)
        : "";
    byId.set(id, { category: cat, summary });
  }

  return messages.map((m) => {
    const id = norm(m.id);
    const hit = byId.get(id);
    if (hit?.summary) return { id: m.id, category: hit.category, summary: hit.summary };
    if (hit) return { id: m.id, category: hit.category, summary: shortSubjectSummary(m.subject) };

    const h = heuristicMailCategory(m.from, m.subject, m.snippet ?? "");
    return { id: m.id, category: h, summary: shortSubjectSummary(m.subject) };
  });
}
