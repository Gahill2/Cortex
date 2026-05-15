import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import {
  CORTEX_SYSTEM_PROMPT,
  looksLikePromptInjection,
  sanitizeUserMessage
} from "../../features/ai/safety.js";
import {
  agentmemoryRemember,
  agentmemorySmartSearch,
  formatMemoryContextHits,
  pingAgentmemory
} from "../../features/agentmemory/client.js";

const chatSchema = z.object({
  message: z.string().min(1).max(4_000),
  conversationId: z.string().min(1).optional(),
  rememberToMemory: z.boolean().optional(),
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

cortexAiRouter.post("/chat", routeRateLimit(20, 60_000), async (req, res) => {
  const input = chatSchema.parse(req.body);
  const message = sanitizeUserMessage(input.message);
  if (looksLikePromptInjection(message)) {
    throw new HttpError(400, "Message rejected: invalid content");
  }

  const conversationId = input.conversationId ?? `conv_${Date.now()}`;
  const userId = req.auth!.userId;
  const project = env.AGENTMEMORY_PROJECT || userId;

  let memoryHits: Awaited<ReturnType<typeof agentmemorySmartSearch>> = [];
  const memoryHealth = await pingAgentmemory();
  if (memoryHealth.ok) {
    try {
      memoryHits = await agentmemorySmartSearch(project, message, 6);
    } catch {
      memoryHits = [];
    }
  }
  const memoryBlock = formatMemoryContextHits(memoryHits);
  const prompt = memoryBlock
    ? `${memoryBlock}\n\nUser message:\n${message}\n\nUse memory only when relevant.`
    : message;

  if (!env.ANTHROPIC_API_KEY) {
    sendSuccess(res, {
      conversationId,
      reply:
        "(AI not configured) Add ANTHROPIC_API_KEY to backend/.env (see backend/.env.example), restart the API, then try again.",
      model: "none",
      memory: { contextHits: memoryHits.length, remembered: false }
    });
    return;
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: CORTEX_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }]
  });

  const reply = (response.content[0] as { type: "text"; text: string }).text;
  const shouldRemember = input.rememberToMemory ?? env.AGENTMEMORY_AUTO_REMEMBER;
  const remembered =
    shouldRemember && memoryHealth.ok
      ? await agentmemoryRemember({
          project,
          conversationId,
          userMessage: message,
          assistantReply: reply
        })
      : false;

  sendSuccess(res, {
    conversationId,
    reply,
    model: response.model,
    memory: { contextHits: memoryHits.length, remembered }
  });
});

cortexAiRouter.post("/command", routeRateLimit(30, 60_000), (req, res) => {
  const input = commandSchema.parse(req.body);
  sendSuccess(res, {
    command: input.command,
    args: input.args,
    status: "accepted",
    queuedAt: new Date().toISOString()
  });
});

cortexAiRouter.post("/tasks/enrich", routeRateLimit(5, 60_000), async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "AI enrichment not configured" });
    return;
  }
  const { title } = enrichSchema.parse(req.body);
  if (looksLikePromptInjection(title)) {
    throw new HttpError(400, "Title rejected: invalid content");
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: CORTEX_SYSTEM_PROMPT,
    messages: [{ role: "user", content: ENRICH_PROMPT.replace("{{title}}", title.slice(0, 500)) }]
  });
  const description = (message.content[0] as { type: "text"; text: string }).text;
  sendSuccess(res, { description });
});
