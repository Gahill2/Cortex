/**
 * Start a Cursor Cloud Agent on github.com/Gahill2/Cortex.
 *
 * Usage:
 *   set CURSOR_API_KEY=cursor_...   (https://cursor.com/dashboard/cloud-agents)
 *   node scripts/cloud-agent/run.mjs
 *
 * Also loads (first match wins): scripts/cloud-agent/.env, then backend/.env
 * (supports CURSOR_API_KEY= or "Cursor API Key =").
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, CursorAgentError } from "@cursor/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");

function applyEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;

  let key;
  let value;
  const standard = trimmed.match(
    /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
  );
  const cursorAlias = trimmed.match(/^Cursor API Key\s*=\s*(.*)$/i);
  if (standard) {
    key = standard[1];
    value = standard[2];
  } else if (cursorAlias) {
    key = "CURSOR_API_KEY";
    value = cursorAlias[1];
  } else return;

  if (key !== "CURSOR_API_KEY" || process.env.CURSOR_API_KEY) return;
  value = value.replace(/^["']|["']$/g, "").trim();
  if (value) process.env.CURSOR_API_KEY = value;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    applyEnvLine(line);
  }
}

loadEnvFile(join(__dirname, ".env"));
loadEnvFile(join(repoRoot, "backend", ".env"));

const REPO = "https://github.com/Gahill2/Cortex";
const BRANCH = "main";

const PROMPT = `You are working on the Cortex monorepo (${REPO}, branch ${BRANCH}).

## Priority 1 — Verify cloud deploy (main has listen-before-migrate)
1. Confirm Railway passes healthcheck on /api/health/live after deploy (server listens first; prisma migrate runs in background).
2. If health still fails, fix startup/migrate/Dockerfile without blocking PORT bind.

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
