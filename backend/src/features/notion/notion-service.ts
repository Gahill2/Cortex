import { env } from "../../config/env.js";

const NOTION_VERSION = "2022-06-28";

export function getNotionToken(): string {
  return (
    process.env.NOTION_PERSONAL_TOKEN?.trim() ||
    process.env.NOTION_INTERNAL_TOKEN?.trim() ||
    env.NOTION_TOKEN?.trim() ||
    ""
  );
}

export function isNotionConfigured(): boolean {
  return Boolean(getNotionToken());
}

export async function testNotionConnection(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  const token = getNotionToken();
  if (!token) return { ok: false, error: "Not configured" };

  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, error: text.slice(0, 200) };
    }
    const data = (await res.json()) as { name?: string; type?: string };
    const label = data.name ?? data.type ?? "Connected";
    return { ok: true, name: label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchNotionPages(query: string, pageSize = 8): Promise<{
  ok: boolean;
  results?: Array<{ id: string; title: string; url?: string }>;
  error?: string;
}> {
  const token = getNotionToken();
  if (!token) return { ok: false, error: "Not configured" };

  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: query || undefined,
        page_size: pageSize,
        filter: { property: "object", value: "page" }
      })
    });
    if (!res.ok) {
      return { ok: false, error: await res.text().catch(() => res.statusText) };
    }
    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        url?: string;
        properties?: Record<string, { title?: Array<{ plain_text?: string }> }>;
      }>;
    };
    const results =
      data.results?.map((p) => {
        const titleProp = Object.values(p.properties ?? {}).find((x) => x.title);
        const title =
          titleProp?.title?.map((t) => t.plain_text ?? "").join("") || "Untitled";
        return { id: p.id, title, url: p.url };
      }) ?? [];
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
