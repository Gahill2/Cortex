/**
 * Start a Cursor Cloud Agent on github.com/Gahill2/Cortex.
 *
 * Usage:
 *   set CURSOR_API_KEY=cursor_...   (https://cursor.com/dashboard/cloud-agents)
 *   node scripts/cloud-agent/run.mjs
 */
import { Agent, CursorAgentError } from "@cursor/sdk";

const REPO = "https://github.com/Gahill2/Cortex";
const BRANCH = "main";

const PROMPT = `You are working on the Cortex monorepo (${REPO}, branch ${BRANCH}).

## Priority 1 — Ship cloud deploy fixes
1. Railway API healthcheck fails: container must listen on PORT before long migrations block startup.
   - Ensure server listens immediately; run prisma migrate in background after listen (see local WIP on server.ts / railway-start.mjs if not on main).
   - Health path: /api/health/live (instant 200).
   - Dockerfile prod stage must include prisma CLI + engines from builder.
2. Verify backend/railway.json healthcheckPath is /api/health/live.

## Priority 2 — Vercel frontend
1. frontend/vercel.json: root directory frontend, Vite build, SPA rewrites.
2. BrandIcon: simple-icons removed siOpenai — use inlined openAiBrand or /brands/openai.svg (fix if build still fails).
3. Production UI: HomeProduction bento home must be default (HomePage.tsx).

## Priority 3 — UI polish & bugs
- Fix visual/layout issues on HomeProduction and widgets (spacing, hierarchy, mobile).
- Fix API client errors when VITE_API_BASE_URL points at Railway (CORS already configured for https://frontend-seven-snowy-13.vercel.app).
- Any TypeScript build errors in frontend or backend.

## Rules
- Create a feature branch, commit focused changes, open a PR with summary + test plan.
- Do not commit secrets or .env files.
- Run frontend \`npm run build\` and backend \`npm run build\` before finishing.
- Keep changes minimal and focused.`;

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey) {
  console.error(
    "CURSOR_API_KEY is not set. Create one at https://cursor.com/dashboard/cloud-agents",
  );
  process.exit(1);
}

const agent = await Agent.create({
  apiKey,
  model: { id: "composer-2" },
  cloud: {
    repos: [{ url: REPO, startingRef: BRANCH }],
    autoCreatePR: true,
    skipReviewerRequest: true,
  },
});

console.log("[cloud-agent] created", { agentId: agent.agentId });

try {
  const run = await agent.send(PROMPT);
  console.log("[cloud-agent] run started", { runId: run.id });

  for await (const event of run.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(block.text);
      }
    }
  }

  const result = await run.wait();
  console.log("\n[cloud-agent] finished", {
    status: result.status,
    git: result.git,
  });

  if (result.status === "error") process.exit(2);
} catch (err) {
  if (err instanceof CursorAgentError) {
    console.error("[cloud-agent] startup failed:", err.message, {
      retryable: err.isRetryable,
    });
    process.exit(1);
  }
  throw err;
} finally {
  await agent[Symbol.asyncDispose]();
}
