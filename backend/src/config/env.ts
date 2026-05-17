import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { z } from "zod";

// Load env files manually — dotenvx v17 populate() doesn't reliably set process.env.
// Variables already in process.env (injected by Electron at spawn) take priority.
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
      const val = raw.replace(/^["']|["']$/g, ""); // strip surrounding quotes
      // Override only if unset or empty (non-empty Electron-injected values win)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch { /* file not found — skip silently */ }
}

const __dir = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dir, "../../.env"));           // backend/.env
loadEnvFile(join(__dir, "../../../.env.local"));  // repo root .env.local (dev overrides)

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1h"),
  CORTEX_DEMO_USER_EMAIL: z.email().default("grey@cortex.local"),
  CORTEX_DEMO_USER_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  CORTEX_DEMO_USER_PIN: z.string().regex(/^\d{4,6}$/).default("1234"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),
  CORTEX_FRONTEND_URL: z.string().optional().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/spotify/oauth/callback"),
  OLLAMA_BASE_URL: z.string().optional().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().optional().default("llama3.2"),
  MICROSOFT_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/microsoft/oauth/callback"),
  /** Public OAuth (https://developers.notion.com/docs/authorization) */
  NOTION_CLIENT_ID: z.string().optional().default(""),
  NOTION_CLIENT_SECRET: z.string().optional().default(""),
  NOTION_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/notion/oauth/callback"),
  /** Optional: internal integration secret — shared for all users when set (good for solo dev / Electron). */
  NOTION_INTERNAL_TOKEN: z.string().optional().default(""),

  /** Apps SDK / CLI scaffold — public app id (e.g. from developer portal or `canva apps create`). */
  CANVA_APP_ID: z.string().optional().default(""),
  /** Hosted app origin for Apps SDK (typically `https://app-….canva-apps.com`). */
  CANVA_APP_ORIGIN: z.string().optional().default(""),
  /** CLI `.env` flag for hot reload in the Canva editor (`true` / `false`). */
  CANVA_HMR_ENABLED: z.string().optional().default(""),

  /** Connect API OAuth client id (`OC-…` from Developer Portal → Connect integration). */
  CANVA_CLIENT_ID: z.string().optional().default(""),
  /** Connect API client secret (`cnvca…`) — server only; never expose to the frontend bundle. */
  CANVA_CLIENT_SECRET: z.string().optional().default(""),
  /** Must match an allowed redirect URL in the Connect integration settings. */
  CANVA_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/canva/oauth/callback"),
  /**
   * Space-separated Connect scopes (must be enabled for the integration in the portal).
   * @see https://www.canva.dev/docs/connect/appendix/scopes/
   */
  CANVA_CONNECT_SCOPES: z.string().optional().default("design:meta:read")
});

export const env = envSchema.parse(process.env);
