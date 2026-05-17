/**
 * Context Injection Package — aggregates user context from all connected
 * integrations (mail, calendar, Spotify, Obsidian, Notion) with PII redaction.
 *
 * Phase 5 roadmap: "Context injection package (mail + calendar + Spotify +
 * Obsidian + Notion) with redaction"
 */
import { listUnifiedInbox } from "../mail/mail-hub.js";
import { isNotionConnected, notionContext } from "../notion/notion-service.js";
import { isSpotifyConfigured, getNowPlaying } from "../spotify/spotify-service.js";
import { prisma } from "../../db/prisma.js";

const MAX_MAIL_SNIPPETS = 5;
const MAX_TASK_CONTEXT = 10;
const SNIPPET_MAX_LEN = 120;

function redactEmail(text: string): string {
  return text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[email]"
  );
}

function redactPhone(text: string): string {
  return text.replace(
    /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    "[phone]"
  );
}

function redact(text: string): string {
  return redactPhone(redactEmail(text));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export interface ContextPiece {
  source: string;
  heading: string;
  content: string;
}

/** Gather recent mail snippets for AI context (redacted). */
async function mailContext(userId: string): Promise<ContextPiece | null> {
  try {
    const { messages } = await listUnifiedInbox(userId, MAX_MAIL_SNIPPETS);
    if (messages.length === 0) return null;

    const lines = messages.map((m) => {
      const from = redact(String(m.from ?? "Unknown"));
      const subject = redact(String(m.subject ?? "(no subject)"));
      const snippet = redact(truncate(String(m.snippet ?? ""), SNIPPET_MAX_LEN));
      const date = m.date ? new Date(String(m.date)).toLocaleDateString() : "";
      return `- **${subject}** from ${from} (${date}): ${snippet}`;
    });

    return {
      source: "mail",
      heading: "Recent emails",
      content: lines.join("\n"),
    };
  } catch {
    return null;
  }
}

/** Gather open tasks for AI context. */
async function taskContext(userId: string): Promise<ContextPiece | null> {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [{ createdById: userId }, { assigneeId: userId }],
        status: { not: "DONE" },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: MAX_TASK_CONTEXT,
      include: { project: { select: { name: true } } },
    });

    if (tasks.length === 0) return null;

    const lines = tasks.map((t) => {
      const due = t.dueDate ? ` (due ${t.dueDate.toLocaleDateString()})` : "";
      return `- [${t.status}] **${t.title}** — ${t.project.name}${due}`;
    });

    return {
      source: "tasks",
      heading: "Open tasks",
      content: lines.join("\n"),
    };
  } catch {
    return null;
  }
}

/** Gather Spotify now-playing state. */
async function spotifyContext(userId: string): Promise<ContextPiece | null> {
  try {
    if (!isSpotifyConfigured()) return null;
    const np = await getNowPlaying(userId);
    if (!np?.playing || !np.track) return null;
    return {
      source: "spotify",
      heading: "Now playing",
      content: `🎵 ${np.track.name} by ${np.track.artists.join(", ")}${np.track.album ? ` (${np.track.album})` : ""}`,
    };
  } catch {
    return null;
  }
}

/** Gather Notion context. */
async function getNotionContext(userId: string): Promise<ContextPiece | null> {
  try {
    if (!(await isNotionConnected(userId))) return null;
    const text = await notionContext(userId);
    if (!text.trim()) return null;
    return {
      source: "notion",
      heading: "Notion (recent pages)",
      content: redact(text),
    };
  } catch {
    return null;
  }
}

export interface InjectedContext {
  pieces: ContextPiece[];
  formatted: string;
}

/**
 * Build the full AI context string from all available integrations.
 * Each source is fetched independently; failures are silently skipped.
 */
export async function buildInjectedContext(
  userId: string,
  opts?: {
    obsidianText?: string;
    includeMail?: boolean;
    includeTasks?: boolean;
    includeSpotify?: boolean;
    includeNotion?: boolean;
  }
): Promise<InjectedContext> {
  const pieces: ContextPiece[] = [];
  const {
    obsidianText,
    includeMail = true,
    includeTasks = true,
    includeSpotify = true,
    includeNotion = true,
  } = opts ?? {};

  const results = await Promise.allSettled([
    includeMail ? mailContext(userId) : null,
    includeTasks ? taskContext(userId) : null,
    includeSpotify ? spotifyContext(userId) : null,
    includeNotion ? getNotionContext(userId) : null,
  ]);

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) pieces.push(r.value);
  }

  if (obsidianText?.trim()) {
    pieces.push({
      source: "obsidian",
      heading: "Obsidian (recent notes)",
      content: redact(obsidianText),
    });
  }

  if (pieces.length === 0) return { pieces: [], formatted: "" };

  const formatted =
    "The following is the user's context from their connected integrations. " +
    "Use it to give informed answers; do not fabricate private data.\n\n" +
    pieces.map((p) => `### ${p.heading}\n${p.content}`).join("\n\n");

  return { pieces, formatted };
}
