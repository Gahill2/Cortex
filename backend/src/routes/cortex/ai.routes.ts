import { Router } from "express";
import { z } from "zod";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { callAI, getAIStatus, resetOllamaCache } from "../../features/ai/ai-provider.js";
import { prisma } from "../../db/prisma.js";
import { getOrCreateCortexUser } from "../../features/auth/cortex-db-user.js";
import { isGmailConfigured, listInbox } from "../../features/gmail/gmail-service.js";
import { isNotionConnected, notionContext } from "../../features/notion/notion-service.js";
import { getObsidianContextForUser } from "./obsidian.routes.js";
import {
  extractJsonArray,
  mergeMailCategories,
} from "../../features/mail/mail-classify.js";

const chatSchema = z.object({
  message: z.string().min(1).max(4_000),
  conversationId: z.string().min(1).optional(),
  systemContext: z.string().max(8_000).optional(),
  /** When true, append recent Obsidian + Notion excerpts to the system prompt. */
  includeWorkspaceContext: z.boolean().optional().default(false),
  context: z
    .object({
      activeModule: z.string().optional(),
      recentFiles: z.array(z.string()).optional(),
      nowPlaying: z.object({ track: z.string(), artist: z.string() }).optional(),
      presenceStatus: z.string().optional()
    })
    .optional()
});

const commandSchema = z.object({
  command: z.string().min(1),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().default({})
});

const enrichSchema = z.object({
  title: z.string().min(1).max(500)
});

const ENRICH_PROMPT = `You are a technical project manager. Write a task description in Markdown for the following task title.

Include:
- One-paragraph summary of what the task involves
- ## Acceptance Criteria (3-5 checklist items, e.g. \`- [ ] ...\`)
- ## Steps (numbered implementation or reproduction steps)
- ## Effort Estimate (XS/S/M/L/XL with one sentence rationale)

Be specific. Be concise. Do not invent requirements not implied by the title.

Task title: {{title}}`;

export const cortexAiRouter = Router();

cortexAiRouter.use(requireAuth);

// ── Status ────────────────────────────────────────────────────────────────────

cortexAiRouter.get("/status", routeRateLimit(30, 60_000), async (_req, res) => {
  const status = await getAIStatus();
  sendSuccess(res, status);
});

// Force-recheck Ollama (call after starting it)
cortexAiRouter.post("/ollama/refresh", routeRateLimit(10, 60_000), async (_req, res) => {
  resetOllamaCache();
  const status = await getAIStatus();
  sendSuccess(res, status);
});

// ── Chat ──────────────────────────────────────────────────────────────────────

cortexAiRouter.post("/chat", routeRateLimit(30, 60_000), async (req, res) => {
  const input = chatSchema.parse(req.body);

  let status;
  try {
    status = await getAIStatus();
  } catch {
    status = { ollama: false, anthropic: false, activeProvider: "none" };
  }

  if (status.activeProvider === "none") {
    sendSuccess(res, {
      conversationId: input.conversationId ?? `conv_${Date.now()}`,
      reply: `(AI not configured) You said: ${input.message.slice(0, 120)}`,
      model: "none"
    });
    return;
  }

  try {
    const baseSystemPrompt = "You are Cortex, a personal AI assistant. Be concise and helpful. You help with tasks, productivity, and general questions.";
    let systemPrompt = input.systemContext
      ? `${baseSystemPrompt}\n\n${input.systemContext}`
      : baseSystemPrompt;

    if (input.includeWorkspaceContext) {
      const pieces: string[] = [];
      const obs = await getObsidianContextForUser(req.auth!.userId);
      if (obs.trim()) pieces.push("### Obsidian (recent notes, excerpts)\n" + obs);
      if (await isNotionConnected(req.auth!.userId)) {
        const n = await notionContext(req.auth!.userId);
        if (n.trim()) pieces.push("### Notion (recent pages, excerpts)\n" + n);
      }
      if (pieces.length) {
        systemPrompt +=
          "\n\nThe following is the user's workspace context from linked tools. Prefer facts from here when answering about their notes; do not invent private data.\n\n" +
          pieces.join("\n\n");
      }
    }

    const result = await callAI(
      [{ role: "user", content: input.message }],
      {
        tier: "simple",
        systemPrompt,
        maxTokens: 1024
      }
    );
    sendSuccess(res, {
      conversationId: input.conversationId ?? `conv_${Date.now()}`,
      reply: result.text,
      model: result.model,
      provider: result.provider
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI error";
    const isCredits = /credit|quota|limit|billing|overload/i.test(msg);
    sendSuccess(res, {
      conversationId: input.conversationId ?? `conv_${Date.now()}`,
      reply: isCredits
        ? "⚠️ AI credits exhausted. Install Ollama for free local AI — click \"Start Ollama\" in the header."
        : `⚠️ AI error: ${msg}`,
      model: "none",
      provider: "none"
    });
  }
});

// ── Command ───────────────────────────────────────────────────────────────────

cortexAiRouter.post("/command", routeRateLimit(30, 60_000), (req, res) => {
  const input = commandSchema.parse(req.body);
  sendSuccess(res, {
    command: input.command,
    args: input.args,
    status: "accepted",
    queuedAt: new Date().toISOString()
  });
});

// ── Daily Briefing ────────────────────────────────────────────────────────────

const todayBriefingGoalsSchema = z.object({
  goals: z
    .array(
      z.object({
        text: z.string().max(500),
        done: z.boolean(),
      })
    )
    .max(80)
    .optional()
    .default([]),
});

cortexAiRouter.get("/briefing", routeRateLimit(10, 300_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { org } = await getOrCreateCortexUser(userId, email);

  // Fetch tasks + today's events in parallel
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const [tasks] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId: org.id, status: { not: "DONE" } },
      include: { project: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 20,
    }),
  ]);

  // Try to get calendar events (optional — won't fail if no calendar)
  let calEvents: Array<{ title: string; start: string }> = [];
  try {
    const { fetchCalendarToday } = await import("./calendar.routes.js");
    calEvents = await fetchCalendarToday(userId, startOfDay, endOfDay);
  } catch { /* no calendar configured */ }

  const taskLines = tasks.map((t) => {
    const due = t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : "";
    const overdue = t.dueDate && new Date(t.dueDate) < today ? " ⚠️ OVERDUE" : "";
    return `- [${t.status}] ${t.title}${due}${overdue} (${t.project.name}, ${t.priority})`;
  }).join("\n") || "No active tasks.";

  const eventLines = calEvents.map((e) => {
    const time = new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `- ${time}: ${e.title}`;
  }).join("\n") || "No events today.";

  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const prompt = `Today is ${dateStr}. Write a brief, friendly daily briefing (3-4 sentences max) for the user. Mention key priorities, any overdue items, and today's schedule. Be motivating but realistic.

Active tasks:
${taskLines}

Today's calendar:
${eventLines}`;

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    sendSuccess(res, {
      briefing: `Good ${today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"}! You have ${tasks.length} active task${tasks.length !== 1 ? "s" : ""} and ${calEvents.length} event${calEvents.length !== 1 ? "s" : ""} today.`,
      provider: "none",
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", maxTokens: 200, systemPrompt: "You are a personal productivity assistant. Write concise daily briefings." }
    );
    sendSuccess(res, { briefing: result.text, provider: result.provider, generatedAt: new Date().toISOString() });
  } catch {
    sendSuccess(res, {
      briefing: `You have ${tasks.length} active task${tasks.length !== 1 ? "s" : ""} today. Stay focused!`,
      provider: "none",
      generatedAt: new Date().toISOString(),
    });
  }
});

/** Full hub briefing: client goals + server tasks/projects + Gmail metadata + calendar. */
cortexAiRouter.post("/today-briefing", routeRateLimit(12, 60_000), async (req, res) => {
  const { userId, email } = req.auth!;
  const { goals } = todayBriefingGoalsSchema.parse(req.body);
  const { org } = await getOrCreateCortexUser(userId, email);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const [tasks, projects, gmailPack] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId: org.id },
      include: { project: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 45,
    }),
    prisma.project.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
    listInbox(userId, 18, "in:inbox").catch(() => ({ connected: false, messages: [] as { id: string; snippet: string; subject: string; from: string; date: string; unread: boolean }[] })),
  ]);

  let calEvents: Array<{ title: string; start: string }> = [];
  try {
    const { fetchCalendarToday } = await import("./calendar.routes.js");
    calEvents = await fetchCalendarToday(userId, startOfDay, endOfDay);
  } catch {
    /* calendar optional */
  }

  const gmailConfigured = isGmailConfigured();
  const gmailConnected = gmailPack.connected;

  const taskStats = {
    todo: tasks.filter((t) => t.status === "TODO").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    done: tasks.filter((t) => t.status === "DONE").length,
  };

  const nowTs = today.getTime();
  const dueSoon = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 14)
    .map((t) => ({
      title: t.title,
      due: t.dueDate,
      project: t.project.name,
      overdue: t.dueDate ? new Date(t.dueDate).getTime() < nowTs : false,
    }));

  const recentTasks = tasks.slice(0, 12).map((t) => ({
    title: t.title,
    status: t.status,
    project: t.project.name,
    priority: t.priority,
  }));

  const emailLines = gmailPack.messages.map((m) => ({
    from: m.from.slice(0, 120),
    subject: m.subject.slice(0, 200),
    date: (m.date ?? "").slice(0, 80),
    unread: m.unread,
    snippet: (m.snippet ?? "").slice(0, 120),
  }));

  const ctx = {
    date: today.toISOString().slice(0, 10),
    goals,
    projects: projects.map((p) => p.name),
    taskStats,
    dueSoon,
    recentTasks,
    emails: emailLines,
    gmailConfigured,
    gmailConnected,
    todayCalendar: calEvents.slice(0, 16).map((e) => ({ title: e.title, start: e.start })),
  };

  const systemPrompt =
    "You are Cortex — a Jarvis-style chief of staff. You receive ONLY JSON context from the user's hub (goals stored on device, Cortex tasks/projects, optional Gmail subject/from/date/snippet samples, optional calendar). Rules: stay strictly within the facts in the JSON; do not invent emails, meetings, or tasks. If gmailConnected is false, say clearly that Gmail is not linked for this account and summarize from goals/tasks/calendar only. If gmailConfigured is false, note the server's Gmail integration is not configured. Output Markdown: first line a short title as `## Today` or similar, then 5–10 bullet lines starting with `- `. Be warm, scannable, action-oriented. Do not include full email bodies.";

  const userContent = `Context JSON:\n${JSON.stringify(ctx)}`;

  const fallbackBriefing = (): string => {
    const lines: string[] = ["## Today", ""];
    if (goals.length === 0) {
      lines.push("- No personal goals on this device yet — add some in Goals.");
    } else {
      const open = goals.filter((g) => !g.done).length;
      lines.push(`- Goals: ${open} open / ${goals.length} total (stored on this device).`);
    }
    lines.push(
      `- Tasks: ${taskStats.todo} todo, ${taskStats.inProgress} in progress, ${taskStats.done} done (${tasks.length} in workspace). Projects: ${projects.length}.`
    );
    if (dueSoon.length) {
      lines.push(
        `- Due focus: ${dueSoon
          .slice(0, 5)
          .map((d) => `${d.title}${d.overdue ? " (overdue)" : ""}`)
          .join("; ")}`
      );
    }
    if (!gmailConfigured) lines.push("- Mail: Gmail API is not configured on this Cortex server.");
    else if (!gmailConnected) lines.push("- Mail: Gmail is not connected — open Mail or Settings to link.");
    else if (emailLines.length === 0) lines.push("- Inbox sample: no threads returned (empty or filtered).");
    else
      lines.push(
        `- Inbox sample: ${emailLines.length} recent thread(s) — subjects include: ${emailLines
          .slice(0, 3)
          .map((e) => `"${e.subject}"`)
          .join(", ")}`
      );
    if (calEvents.length) lines.push(`- Calendar today: ${calEvents.length} event(s).`);
    return lines.join("\n");
  };

  const metaBase = {
    gmailConnected,
    gmailConfigured,
    generatedAt: new Date().toISOString(),
    provider: "none" as string,
  };

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    sendSuccess(
      res,
      {
        briefing: fallbackBriefing(),
        ...metaBase,
        mode: "fallback" as const,
      },
      "live"
    );
    return;
  }

  try {
    const result = await callAI([{ role: "user", content: userContent }], {
      tier: "simple",
      maxTokens: 900,
      systemPrompt,
    });
    sendSuccess(
      res,
      {
        briefing: (result.text ?? "").trim() || fallbackBriefing(),
        gmailConnected,
        gmailConfigured,
        generatedAt: new Date().toISOString(),
        provider: result.provider,
        mode: "ai" as const,
      },
      "live"
    );
  } catch {
    sendSuccess(
      res,
      {
        briefing: `⚠️ Briefing AI hit an error — quick scan:\n\n${fallbackBriefing()}`,
        ...metaBase,
        mode: "error_fallback",
      },
      "live"
    );
  }
});

// ── Task Enrich ───────────────────────────────────────────────────────────────

cortexAiRouter.post("/tasks/enrich", routeRateLimit(5, 60_000), async (req, res) => {
  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    throw new HttpError(503, "AI enrichment not available — configure Anthropic API key or start Ollama");
  }

  const { title } = enrichSchema.parse(req.body);
  const result = await callAI(
    [{ role: "user", content: ENRICH_PROMPT.replace("{{title}}", title) }],
    { tier: "simple", maxTokens: 800 }
  );
  sendSuccess(res, { description: result.text, provider: result.provider });
});

// ── Mail: AI Organize ─────────────────────────────────────────────────────────
// POST /ai/mail/organize   body: { messages: [{id,from,subject,snippet}] }

const CATEGORIES = ["work", "school", "personal", "social", "media", "finance", "newsletters", "important", "other"] as const;

const organizeSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    from: z.string(),
    subject: z.string(),
    snippet: z.string().optional().default(""),
  })).max(50),
  /** Skip LLM — rules + any partial AI merge only when false */
  rulesOnly: z.boolean().optional().default(false),
});

cortexAiRouter.post("/mail/organize", routeRateLimit(20, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const { messages, rulesOnly } = organizeSchema.parse(req.body);
  if (messages.length === 0) { sendSuccess(res, { categories: [], mode: "none" }); return; }

  const status = await getAIStatus();

  let aiRows: Array<{ id?: unknown; category?: unknown; summary?: unknown }> = [];

  const wantAi = !rulesOnly && status.activeProvider !== "none";

  if (wantAi) {
    const emailList = messages.map((m, i) =>
      `${i + 1}. id="${m.id}" from="${m.from}" subject="${m.subject}" snippet="${m.snippet?.slice(0, 120)}"`
    ).join("\n");

    const prompt = `Categorize each email into exactly one category from: work, school, personal, social, media, finance, newsletters, important, other.
Also write a 1-sentence summary (max 15 words) for each.

Return ONLY a JSON array, no prose, no markdown fences. Include every id listed below exactly once.
[{"id":"...","category":"...","summary":"..."}]

Emails:
${emailList}`;

    try {
      const result = await callAI(
        [{ role: "user", content: prompt }],
        { tier: "simple", maxTokens: 2000, systemPrompt: "You are an email classifier. Return only valid JSON." }
      );

      const parsed = extractJsonArray(result.text);
      if (parsed) aiRows = parsed as Array<{ id?: unknown; category?: unknown; summary?: unknown }>;
    } catch { /* fall through — merge fills gaps with heuristics */ }
  }

  const categories = mergeMailCategories(messages, aiRows, CATEGORIES);

  await Promise.all(categories.map((c) => prisma.mailCategory.upsert({
    where: { userId_messageId: { userId, messageId: c.id } },
    update: { category: c.category, summary: c.summary },
    create: { userId, messageId: c.id, category: c.category, summary: c.summary },
  })));

  const mode = rulesOnly ? "rules" : wantAi ? "ai+rules" : "rules";
  sendSuccess(res, { categories, mode }, "live");
});

// GET /ai/mail/categories  — return stored categories for userId
cortexAiRouter.get("/mail/categories", routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const rows = await prisma.mailCategory.findMany({ where: { userId } });
  // Group by category
  const grouped: Record<string, { messageId: string; summary: string | null }[]> = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({ messageId: r.messageId, summary: r.summary });
  }
  // Counts
  const counts: Record<string, number> = {};
  for (const [cat, msgs] of Object.entries(grouped)) counts[cat] = msgs.length;
  sendSuccess(res, { counts, categories: grouped });
});

// ── Mail: AI Reply Draft ──────────────────────────────────────────────────────
// POST /ai/mail/reply   body: { from, subject, body }

const replySchema = z.object({
  from: z.string(),
  subject: z.string(),
  body: z.string().max(8_000),
});

cortexAiRouter.post("/mail/reply", routeRateLimit(10, 60_000), async (req, res) => {
  const { from, subject, body } = replySchema.parse(req.body);

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    throw new HttpError(503, "AI not available");
  }

  const prompt = `Draft a professional, concise reply to this email. Write only the reply body — no subject, no "Dear...", no signature placeholder. Use the same tone as the original.

From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 3000)}`;

  const result = await callAI(
    [{ role: "user", content: prompt }],
    { tier: "simple", maxTokens: 400, systemPrompt: "You write email replies. Return only the reply body text, nothing else." }
  );

  sendSuccess(res, { draft: result.text, provider: result.provider });
});

// ── Tasks: Natural Language Parse ─────────────────────────────────────────────
// POST /ai/tasks/parse   body: { text }

const parseTaskSchema = z.object({ text: z.string().min(1).max(500) });

cortexAiRouter.post("/tasks/parse", routeRateLimit(20, 60_000), async (req, res) => {
  const { text } = parseTaskSchema.parse(req.body);
  const today = new Date().toISOString().split("T")[0];

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    // Fallback: return text as title with no extras
    sendSuccess(res, { title: text, priority: "MEDIUM", dueDate: null, description: null });
    return;
  }

  const prompt = `Parse this task description into structured fields. Today is ${today}.
Return ONLY JSON, no prose:
{"title":"...","priority":"LOW|MEDIUM|HIGH","dueDate":"YYYY-MM-DD or null","description":"one sentence or null"}

Rules:
- title: clean task name (no date/priority words)
- priority: HIGH if urgent/important/asap/critical, LOW if someday/whenever/low, else MEDIUM
- dueDate: extract if mentioned (today, tomorrow, Monday, next Friday, Dec 3, etc) — ISO date or null
- description: only if there's meaningful extra context, else null

Task: "${text}"`;

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", maxTokens: 150, systemPrompt: "You parse task descriptions into JSON. Return only valid JSON." }
    );
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { title: string; priority: string; dueDate: string | null; description: string | null };
      sendSuccess(res, {
        title: parsed.title ?? text,
        priority: ["LOW","MEDIUM","HIGH"].includes(parsed.priority) ? parsed.priority : "MEDIUM",
        dueDate: parsed.dueDate ?? null,
        description: parsed.description ?? null,
        provider: result.provider,
      });
      return;
    }
  } catch { /* fall through */ }

  sendSuccess(res, { title: text, priority: "MEDIUM", dueDate: null, description: null });
});

// ── AI Theme Generation ───────────────────────────────────────────────────────
// POST /ai/theme/generate   body: { topic }
const themeGenSchema = z.object({ topic: z.string().min(1).max(300) });

cortexAiRouter.post("/theme/generate", routeRateLimit(10, 60_000), async (req, res) => {
  const { topic } = themeGenSchema.parse(req.body);

  const prompt = `Create a stunning dark iOS-style color theme for: "${topic}".
Return ONLY valid JSON, no prose, no markdown:
{
  "name": "2-3 word theme name",
  "gradient": "CSS linear-gradient (dark, multi-stop, diagonal 135deg, beautiful)",
  "accent": "#hexcolor (vibrant, pops on dark bg)",
  "accentSecondary": "#hexcolor (complementary to accent)",
  "widgetBg": "rgba(r,g,b,0.65) (dark glass tinted to theme)",
  "description": "one poetic sentence"
}
Rules:
- gradient: dark and rich, e.g. "linear-gradient(135deg, #020b18 0%, #0a2540 50%, #051030 100%)"
- accent: bright vibrant color matching topic mood
- widgetBg: MUST be dark (opacity 0.55-0.72), slightly tinted with theme color
- Premium dark aesthetic, NOT pastel, NOT pure black`;

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    // Fallback gradient based on topic length (deterministic)
    const hue = (topic.length * 37) % 360;
    sendSuccess(res, {
      name: topic.slice(0, 20),
      gradient: `linear-gradient(135deg, hsl(${hue},60%,8%) 0%, hsl(${(hue+40)%360},50%,15%) 100%)`,
      accent: `hsl(${hue},70%,60%)`,
      accentSecondary: `hsl(${(hue+40)%360},60%,55%)`,
      widgetBg: `rgba(10,10,20,0.65)`,
      description: "AI unavailable — using generated palette.",
    });
    return;
  }

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", maxTokens: 200, systemPrompt: "You generate color themes. Return only valid JSON." }
    );
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
      sendSuccess(res, {
        name: parsed.name ?? topic,
        gradient: parsed.gradient ?? "linear-gradient(135deg, #0a0a14 0%, #12122a 100%)",
        accent: parsed.accent ?? "#5b8dff",
        accentSecondary: parsed.accentSecondary ?? "#a855f7",
        widgetBg: parsed.widgetBg ?? "rgba(20,20,32,0.65)",
        description: parsed.description ?? "",
        provider: result.provider,
      });
      return;
    }
  } catch { /* fall through */ }

  // Fallback
  sendSuccess(res, {
    name: topic,
    gradient: "linear-gradient(135deg, #0a0a14 0%, #1a0a2e 50%, #0f0f24 100%)",
    accent: "#5b8dff",
    accentSecondary: "#a855f7",
    widgetBg: "rgba(20,20,32,0.65)",
    description: "",
  });
});

// ── AI Meeting Prep ───────────────────────────────────────────────────────────
// GET /ai/meeting-prep?date=YYYY-MM-DD

cortexAiRouter.get("/meeting-prep", routeRateLimit(5, 300_000), async (req, res) => {
  const userId = req.auth!.userId;
  const dateParam = (req.query.date as string) ?? new Date().toISOString().split("T")[0];

  const d = new Date(dateParam + "T00:00:00");
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

  // Fetch calendar events
  let events: Array<{ title: string; start: string; end: string; location?: string }> = [];
  try {
    const { fetchCalendarToday } = await import("./calendar.routes.js");
    const raw = await fetchCalendarToday(userId, start, end);
    events = raw.map((e) => ({ title: e.title, start: e.start, end: e.start, location: undefined }));
  } catch { /* no calendar */ }

  if (events.length === 0) {
    sendSuccess(res, { meetings: [], briefing: "No meetings scheduled for this day.", generatedAt: new Date().toISOString() });
    return;
  }

  const status = await getAIStatus();
  if (status.activeProvider === "none") {
    sendSuccess(res, {
      meetings: events.map((e) => ({ title: e.title, time: e.start, prep: "AI not available for prep notes." })),
      briefing: `${events.length} meeting${events.length !== 1 ? "s" : ""} scheduled.`,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const eventList = events.map((e) => `- ${fmtTime(e.start)}: ${e.title}${e.location ? ` @ ${e.location}` : ""}`).join("\n");

  const prompt = `For each meeting below, write 2-3 bullet prep notes (what to prepare, think about, or bring). Be specific and actionable.

Also write a 1-sentence day summary.

Return ONLY JSON:
{
  "summary": "...",
  "meetings": [{"title":"...","time":"...","prep":["bullet1","bullet2","bullet3"]}]
}

Meetings on ${dateParam}:
${eventList}`;

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      { tier: "simple", maxTokens: 600, systemPrompt: "You prepare meeting briefs. Return only valid JSON." }
    );
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { summary: string; meetings: Array<{ title: string; time: string; prep: string[] }> };
      sendSuccess(res, { ...parsed, generatedAt: new Date().toISOString(), provider: result.provider });
      return;
    }
  } catch { /* fall through */ }

  sendSuccess(res, {
    meetings: events.map((e) => ({ title: e.title, time: fmtTime(e.start), prep: ["Review agenda", "Prepare questions", "Check related materials"] })),
    briefing: `${events.length} meeting${events.length !== 1 ? "s" : ""} scheduled.`,
    generatedAt: new Date().toISOString(),
  });
});
