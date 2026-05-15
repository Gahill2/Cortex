import { existsSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { z } from "zod";

/**
 * Single env story for the monorepo:
 * 1) `<repo>/.env` if it exists (shared by `npm run dev`, Electron-spawned API, tools)
 * 2) else `<repo>/backend/.env` (legacy / Prisma-friendly default)
 *
 * Works from `src/config/` (tsx) and `dist/src/config/` (compiled / Electron).
 */
function resolveBackendEnvPath(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(dir, "prisma", "schema.prisma"))) {
      const backendRoot = dir;
      const repoRoot = dirname(backendRoot);
      const rootEnv = join(repoRoot, ".env");
      if (existsSync(rootEnv)) return rootEnv;
      return join(backendRoot, ".env");
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../../../.env");
}

config({ path: resolveBackendEnvPath(), override: true });

const WEAK_DEMO_PASSWORDS = new Set(["ChangeMe123!", "Password123!", "password", "12345678"]);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1h"),
  CORTEX_DEMO_USER_EMAIL: z.email().optional(),
  CORTEX_DEMO_USER_PASSWORD: z.string().min(8).optional(),
  CORTEX_DEMO_USER_PIN: z.string().regex(/^\d{4,6}$/).optional(),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),
  GOOGLE_REDIRECT_URL: z.string().optional().default(""),
  CORTEX_FRONTEND_URL: z.string().optional().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/spotify/oauth/callback"),
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  FIRESTORE_ENV_DOC: z.string().optional().default("cortex_config/env"),
  ALLOW_FIREBASE_ENV_SYNC: z.string().optional().default(""),
  N8N_WEBHOOK_URL: z.string().optional().default(""),
  N8N_WEBHOOK_SECRET: z.string().optional().default(""),
  NOTION_TOKEN: z.string().optional().default(""),
  NOTION_PERSONAL_TOKEN: z.string().optional().default(""),
  NOTION_INTERNAL_TOKEN: z.string().optional().default(""),
  CANVA_CLIENT_ID: z.string().optional().default(""),
  CANVA_APP_ID: z.string().optional().default(""),
  CORTEX_MCP_MODE: z.string().optional().default(""),
  CORTEX_MCP_HOST: z.string().optional().default(""),
  CORTEX_MCPPORT: z.string().optional().default(""),
  CORTEX_DESKTOP_SECRET: z.string().optional().default(""),
  CORS_ORIGINS: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRO_PRICE_ID: z.string().optional().default(""),
  AGENTMEMORY_URL: z.string().optional().default("http://127.0.0.1:3111"),
  AGENTMEMORY_SECRET: z.string().optional().default(""),
  AGENTMEMORY_PROJECT: z.string().optional().default(""),
  AGENTMEMORY_AUTO_REMEMBER: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  OBSIDIAN_VAULT_PATH: z.string().optional().default(""),
  OBSIDIAN_VAULT_PATHS: z.string().optional().default(""),
  CORTEX_ENABLE_VAULT_WATCHER: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase()))
});

const parsed = envSchema.parse(process.env);

const isProd = parsed.NODE_ENV === "production";
const demoEmail = parsed.CORTEX_DEMO_USER_EMAIL ?? (isProd ? undefined : "grey@cortex.local");
const demoPassword = parsed.CORTEX_DEMO_USER_PASSWORD ?? (isProd ? undefined : "ChangeMe123!");
const demoPin = parsed.CORTEX_DEMO_USER_PIN ?? (isProd ? undefined : "1234");

if (isProd) {
  if (demoPassword && WEAK_DEMO_PASSWORDS.has(demoPassword)) {
    throw new Error("CORTEX_DEMO_USER_PASSWORD is too weak for production — set a strong value or unset demo vars");
  }
  if (demoPin === "1234") {
    throw new Error("CORTEX_DEMO_USER_PIN must not be 1234 in production");
  }
}

/** Legacy password/PIN login — disabled in production unless all demo env vars are explicitly set. */
export const demoAuthEnabled =
  !isProd || Boolean(demoEmail && demoPassword && demoPin);

export const env = {
  ...parsed,
  CORTEX_DEMO_USER_EMAIL: demoEmail ?? (isProd ? "" : "grey@cortex.local"),
  CORTEX_DEMO_USER_PASSWORD: demoPassword ?? (isProd ? "" : "ChangeMe123!"),
  CORTEX_DEMO_USER_PIN: demoPin ?? (isProd ? "" : "1234")
};
