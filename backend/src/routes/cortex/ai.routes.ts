import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { z } from "zod";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";

const chatSchema = z.object({
  message: z.string().min(1).max(4_000),
  conversationId: z.string().min(1).optional(),
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

cortexAiRouter.post("/chat", routeRateLimit(30, 60_000), async (req, res) => {
  const input = chatSchema.parse(req.body);

  if (!process.env.ANTHROPIC_API_KEY) {
    sendSuccess(res, {
      conversationId: input.conversationId ?? `conv_${Date.now()}`,
      reply: `(AI not configured) You said: ${input.message.slice(0, 120)}`,
      model: "none"
    });
    return;
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: "You are Cortex, a personal AI assistant. Be concise and helpful. You help with tasks, productivity, and general questions.",
    messages: [{ role: "user", content: input.message }]
  });

  const reply = (message.content[0] as { type: "text"; text: string }).text;
  sendSuccess(res, {
    conversationId: input.conversationId ?? `conv_${Date.now()}`,
    reply,
    model: message.model
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
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "AI enrichment not configured" });
    return;
  }
  const { title } = enrichSchema.parse(req.body);
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: ENRICH_PROMPT.replace("{{title}}", title) }]
  });
  const description = (message.content[0] as { type: "text"; text: string }).text;
  sendSuccess(res, { description });
});
