import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { z } from "zod";

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const val = raw.replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    /* file not found — skip */
  }
}

function resolveBackendEnvPaths(): string[] {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(dir, "prisma", "schema.prisma"))) {
      const backendRoot = dir;
      const repoRoot = dirname(backendRoot);
      const paths = [join(repoRoot, ".env"), join(backendRoot, ".env"), join(repoRoot, ".env.local")];
      return paths.filter((p) => existsSync(p));
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallbackDir = dirname(fileURLToPath(import.meta.url));
  return [join(fallbackDir, "../../.env"), join(fallbackDir, "../../../.env.local")];
}

for (const p of resolveBackendEnvPaths()) {
  loadEnvFile(p);
}

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
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().optional().default("https://api.openai.com"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  /** Homelab/local: return OTP in API + UI when SMTP is missing (do not use on public internet). */
  CORTEX_OTP_DEV_FALLBACK: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/spotify/oauth/callback"),
  OLLAMA_BASE_URL: z.string().optional().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().optional().default("llama3.2"),
  MICROSOFT_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/microsoft/oauth/callback"),
  NOTION_CLIENT_ID: z.string().optional().default(""),
  NOTION_CLIENT_SECRET: z.string().optional().default(""),
  NOTION_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/notion/oauth/callback"),
  NOTION_TOKEN: z.string().optional().default(""),
  NOTION_PERSONAL_TOKEN: z.string().optional().default(""),
  NOTION_INTERNAL_TOKEN: z.string().optional().default(""),
  CANVA_APP_ID: z.string().optional().default(""),
  CANVA_APP_ORIGIN: z.string().optional().default(""),
  CANVA_HMR_ENABLED: z.string().optional().default(""),
  CANVA_CLIENT_ID: z.string().optional().default(""),
  CANVA_CLIENT_SECRET: z.string().optional().default(""),
  CANVA_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/canva/oauth/callback"),
  CANVA_CONNECT_SCOPES: z.string().optional().default("design:meta:read"),
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  FIREBASE_USE_APPLICATION_DEFAULT: z.string().optional().default(""),
  FIRESTORE_ENV_DOC: z.string().optional().default("cortex_config/env"),
  ALLOW_FIREBASE_ENV_SYNC: z.string().optional().default(""),
  N8N_WEBHOOK_URL: z.string().optional().default(""),
  N8N_WEBHOOK_SECRET: z.string().optional().default(""),
  CORTEX_MCP_MODE: z.string().optional().default(""),
  CORTEX_MCP_HOST: z.string().optional().default(""),
  CORTEX_MCP_PORT: z.string().optional().default(""),
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
  OBSIDIAN_VAULT_NAME: z.string().optional().default("greyhill_brain"),
  OBSIDIAN_AI_LOG_PATH: z.string().optional().default("Cortex/AI Log.md"),
  OBSIDIAN_CAPTURE_PATH: z.string().optional().default("Cortex/Capture.md"),
  OBSIDIAN_USE_CLI: z
    .string()
    .optional()
    .default("true")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  OBSIDIAN_AI_LOG_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  CORTEX_ENABLE_VAULT_WATCHER: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  /** Persistent API files (canvas images, obsidian sidecar, vault index). Homelab: `/app/data`. */
  CORTEX_API_DATA_DIR: z.string().optional().default("")
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

export const demoAuthEnabled =
  !isProd || Boolean(demoEmail && demoPassword && demoPin);

export const env = {
  ...parsed,
  CORTEX_DEMO_USER_EMAIL: demoEmail ?? (isProd ? "" : "grey@cortex.local"),
  CORTEX_DEMO_USER_PASSWORD: demoPassword ?? (isProd ? "" : "ChangeMe123!"),
  CORTEX_DEMO_USER_PIN: demoPin ?? (isProd ? "" : "1234")
};
