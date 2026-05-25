/** Parse Obsidian wikilinks from markdown: [[target]] or [[target|alias]] */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(WIKILINK_RE)) {
    const raw = match[1]?.trim();
    if (raw) links.push(raw);
  }
  return links;
}

/** Normalize a link target or note id for graph matching (case-insensitive, no .md). */
export function normalizeNoteId(value: string): string {
  let id = value.trim().replace(/\\/g, "/");
  if (id.endsWith(".md")) id = id.slice(0, -3);
  return id.toLowerCase();
}

/** Basename without extension — fallback when full path link not found. */
export function basenameNoteId(value: string): string {
  const norm = normalizeNoteId(value);
  const parts = norm.split("/");
  return parts[parts.length - 1] ?? norm;
}
