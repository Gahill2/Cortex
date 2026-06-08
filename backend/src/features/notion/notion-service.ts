import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  DatabaseObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import { env } from "../../config/env.js";
import {
  hasEnvIntegrationOAuth,
  isIntegrationOAuthReady,
  resolveIntegrationOAuth,
} from "../integrations/oauth-config.js";
import { HttpError } from "../../utils/http-error.js";
import { getNotionTokens } from "./notion-token-store.js";

const NOTION_AUTH = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN = "https://api.notion.com/v1/oauth/token";

export const isNotionOAuthConfigured = (): boolean => hasEnvIntegrationOAuth("notion");

export const isNotionOAuthConfiguredAsync = async (): Promise<boolean> =>
  isIntegrationOAuthReady("notion");

export const hasNotionInternalToken = (): boolean => Boolean(env.NOTION_INTERNAL_TOKEN?.trim());

export const hasNotionPersonalToken = (): boolean => Boolean(env.NOTION_PERSONAL_TOKEN?.trim());

export const isNotionConfigured = (): boolean =>
  isNotionOAuthConfigured() || hasNotionInternalToken() || hasNotionPersonalToken();

export const buildNotionAuthUrl = async (state: string): Promise<string> => {
  const oauth = await resolveIntegrationOAuth("notion");
  if (!oauth) throw new HttpError(503, "Notion OAuth not configured");
  const u = new URL(NOTION_AUTH);
  u.searchParams.set("client_id", oauth.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("owner", "user");
  u.searchParams.set("redirect_uri", oauth.redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
};

export interface NotionTokenExchangeResult {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
}

export const exchangeNotionCode = async (code: string): Promise<NotionTokenExchangeResult> => {
  const oauth = await resolveIntegrationOAuth("notion");
  if (!oauth) throw new HttpError(503, "Notion OAuth not configured");
  const basic = Buffer.from(`${oauth.clientId}:${oauth.clientSecret}`).toString("base64");
  const r = await fetch(NOTION_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauth.redirectUri,
    }),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    throw new HttpError(502, `Notion token exchange failed: ${r.status} ${err.slice(0, 200)}`);
  }
  const data = (await r.json()) as NotionTokenExchangeResult;
  if (!data.access_token) throw new HttpError(502, "Notion token response missing access_token");
  return data;
};

export async function getNotionAccessToken(userId: string): Promise<string | null> {
  const row = await getNotionTokens(userId);
  if (row?.access_token) return row.access_token;
  return (
    env.NOTION_PERSONAL_TOKEN?.trim() ||
    env.NOTION_INTERNAL_TOKEN?.trim() ||
    null
  );
}

export async function isNotionConnected(userId: string): Promise<boolean> {
  const t = await getNotionAccessToken(userId);
  return Boolean(t);
}

function notionClient(token: string): Client {
  return new Client({ auth: token, notionVersion: "2022-06-28" });
}

/** Used by integrations hub status panel. */
export async function testNotionConnection(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  const token =
    env.NOTION_PERSONAL_TOKEN?.trim() ||
    env.NOTION_INTERNAL_TOKEN?.trim() ||
    "";
  if (!token) return { ok: false, error: "Not configured" };

  try {
    const notion = notionClient(token);
    const me = await notion.users.me({});
    const label = "name" in me && me.name ? me.name : me.type ?? "Connected";
    return { ok: true, name: label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function richToPlain(rich: RichTextItemResponse[] | undefined): string {
  if (!rich?.length) return "";
  return rich.map((t) => t.plain_text).join("");
}

function blockToLines(block: BlockObjectResponse): string[] {
  const lines: string[] = [];
  switch (block.type) {
    case "paragraph":
      lines.push(richToPlain(block.paragraph.rich_text));
      break;
    case "heading_1":
      lines.push("# " + richToPlain(block.heading_1.rich_text));
      break;
    case "heading_2":
      lines.push("## " + richToPlain(block.heading_2.rich_text));
      break;
    case "heading_3":
      lines.push("### " + richToPlain(block.heading_3.rich_text));
      break;
    case "bulleted_list_item":
      lines.push("- " + richToPlain(block.bulleted_list_item.rich_text));
      break;
    case "numbered_list_item":
      lines.push("1. " + richToPlain(block.numbered_list_item.rich_text));
      break;
    case "to_do":
      lines.push(
        (block.to_do.checked ? "[x] " : "[ ] ") + richToPlain(block.to_do.rich_text)
      );
      break;
    case "quote":
      lines.push("> " + richToPlain(block.quote.rich_text));
      break;
    case "code":
      lines.push("```\n" + richToPlain(block.code.rich_text) + "\n```");
      break;
    case "callout":
      lines.push(richToPlain(block.callout.rich_text));
      break;
    case "toggle":
      lines.push(richToPlain(block.toggle.rich_text));
      break;
    case "divider":
      lines.push("---");
      break;
    default:
      break;
  }
  return lines.filter((l) => l.length > 0);
}

async function collectBlockText(
  notion: Client,
  blockId: string,
  depth: number,
  out: string[]
): Promise<void> {
  if (depth > 8) return;
  let cursor: string | undefined;
  for (;;) {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const b of res.results) {
      if (!("type" in b)) continue;
      const block = b as BlockObjectResponse;
      out.push(...blockToLines(block));
      if (block.has_children) {
        await collectBlockText(notion, block.id, depth + 1, out);
      }
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
}

function titleFromPage(page: PageObjectResponse): string {
  const props = page.properties;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title" && p.title?.length) {
      return p.title.map((t: RichTextItemResponse) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

/** Integrations hub quick search (env token). */
export async function searchNotionPages(
  query: string,
  pageSize = 8
): Promise<{
  ok: boolean;
  results?: Array<{ id: string; title: string; url?: string }>;
  error?: string;
}> {
  const token =
    env.NOTION_PERSONAL_TOKEN?.trim() ||
    env.NOTION_INTERNAL_TOKEN?.trim() ||
    "";
  if (!token) return { ok: false, error: "Not configured" };

  try {
    const notion = notionClient(token);
    const res = await notion.search({
      query: query.trim() || undefined,
      filter: { property: "object", value: "page" },
      page_size: pageSize,
    });
    const pages = res.results.filter((r): r is PageObjectResponse => "properties" in r);
    return {
      ok: true,
      results: pages.map((p) => ({
        id: p.id,
        title: titleFromPage(p),
        url: p.url ?? undefined,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function notionSearch(
  userId: string,
  query: string
): Promise<Array<{ id: string; title: string; url: string | null; last_edited: string }>> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const res = await notion.search({
    query: query.trim() || undefined,
    filter: { property: "object", value: "page" },
    page_size: 25,
  });
  const pages = res.results.filter((r): r is PageObjectResponse => "properties" in r);
  return pages.map((p) => ({
    id: p.id,
    title: titleFromPage(p),
    url: p.url ?? null,
    last_edited: p.last_edited_time,
  }));
}

export async function notionGetPage(
  userId: string,
  pageId: string
): Promise<{ id: string; title: string; url: string | null; body: string; last_edited: string }> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const page = (await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  const title = titleFromPage(page);
  const lines: string[] = [];
  await collectBlockText(notion, pageId, 0, lines);
  return {
    id: page.id,
    title,
    url: page.url ?? null,
    body: lines.join("\n\n"),
    last_edited: page.last_edited_time,
  };
}

/** Shallow excerpt of recently edited pages for AI / cross-tool context. */
export async function notionContext(userId: string, maxChars = 8000): Promise<string> {
  const token = await getNotionAccessToken(userId);
  if (!token) return "";
  const notion = notionClient(token);
  const res = await notion.search({
    filter: { property: "object", value: "page" },
    page_size: 8,
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });
  const pages = res.results.filter((r): r is PageObjectResponse => "properties" in r);
  const chunks: string[] = [];
  let used = 0;
  for (const p of pages) {
    if (used >= maxChars) break;
    const page = (await notion.pages.retrieve({ page_id: p.id })) as PageObjectResponse;
    const title = titleFromPage(page);
    const lines: string[] = [];
    const children = await notion.blocks.children.list({ block_id: p.id, page_size: 20 });
    for (const b of children.results) {
      if (!("type" in b)) continue;
      lines.push(...blockToLines(b as BlockObjectResponse));
    }
    const body = lines.join("\n").slice(0, 1200);
    const piece = `## ${title} (Notion)\n${body}`;
    if (used + piece.length > maxChars) break;
    chunks.push(piece);
    used += piece.length;
  }
  return chunks.join("\n\n---\n\n");
}

function cellToPlain(cell: unknown): string {
  if (!cell || typeof cell !== "object" || !("type" in cell)) return "";
  const c = cell as { type: string; [k: string]: unknown };
  const inner = c[c.type] as Record<string, unknown> | undefined;
  if (!inner) return "";
  switch (c.type) {
    case "title": {
      const arr = inner.title as RichTextItemResponse[] | undefined;
      return richToPlain(arr);
    }
    case "rich_text": {
      const arr = inner.rich_text as RichTextItemResponse[] | undefined;
      return richToPlain(arr);
    }
    case "number":
      return String(inner.number ?? "");
    case "select":
      return (inner.select as { name?: string } | null)?.name ?? "";
    case "multi_select":
      return ((inner.multi_select as { name: string }[] | undefined) ?? []).map((s) => s.name).join(", ");
    case "date": {
      const d = inner.date as { start?: string } | null;
      return d?.start ?? "";
    }
    case "checkbox":
      return inner.checkbox ? "yes" : "no";
    case "url":
      return String(inner.url ?? "");
    case "email":
      return String(inner.email ?? "");
    case "phone_number":
      return String(inner.phone_number ?? "");
    case "status":
      return (inner.status as { name?: string } | null)?.name ?? "";
    default:
      return JSON.stringify(inner).slice(0, 120);
  }
}

/** Notion block payloads for append/create (paragraphs from non-empty lines). */
export type NotionParagraphBlock = {
  object: "block";
  type: "paragraph";
  paragraph: { rich_text: Array<{ type: "text"; text: { content: string } }> };
};

export function markdownToNotionBlocks(markdown: string, maxBlocks = 90): NotionParagraphBlock[] {
  const lines = markdown
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.slice(0, 2000));
  const blocks: NotionParagraphBlock[] = lines.map((line) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: line } }],
    },
  }));
  return blocks.slice(0, maxBlocks);
}

export async function notionListDatabases(
  userId: string,
  query: string
): Promise<Array<{ id: string; title: string }>> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const res = await notion.search({
    query: query.trim() || undefined,
    filter: { property: "object", value: "database" },
    page_size: 50,
  });
  return res.results
    .filter((r): r is DatabaseObjectResponse => (r as DatabaseObjectResponse).object === "database")
    .map((d) => ({
      id: d.id,
      title: richToPlain(d.title) || "Untitled",
    }));
}

export async function notionQueryDatabase(
  userId: string,
  databaseId: string,
  startCursor?: string
): Promise<{
  rows: Array<{ id: string; url: string | null; properties: Record<string, string> }>;
  next_cursor: string | null;
}> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const res = await notion.databases.query({
    database_id: databaseId,
    page_size: 25,
    start_cursor: startCursor,
  });
  const rows = res.results
    .filter((r): r is PageObjectResponse => "properties" in r)
    .map((p) => {
      const properties: Record<string, string> = {};
      for (const [k, v] of Object.entries(p.properties)) {
        properties[k] = cellToPlain(v);
      }
      return { id: p.id, url: p.url ?? null, properties };
    });
  return { rows, next_cursor: res.next_cursor ?? null };
}

export async function notionCreateChildPage(
  userId: string,
  parentPageId: string,
  title: string,
  bodyMarkdown: string
): Promise<{ id: string; url: string | null }> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const children = markdownToNotionBlocks(bodyMarkdown, 90);
  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: { title: [{ type: "text", text: { content: title.slice(0, 2000) } }] },
    },
    ...(children.length ? { children } : {}),
  });
  return { id: page.id, url: "url" in page && page.url ? page.url : null };
}

export async function notionAppendMarkdown(
  userId: string,
  pageId: string,
  markdown: string
): Promise<void> {
  const token = await getNotionAccessToken(userId);
  if (!token) throw new HttpError(400, "Notion not connected");
  const notion = notionClient(token);
  const all = markdownToNotionBlocks(markdown, 2000);
  for (let i = 0; i < all.length; i += 90) {
    const chunk = all.slice(i, i + 90);
    if (chunk.length) await notion.blocks.children.append({ block_id: pageId, children: chunk });
  }
}
