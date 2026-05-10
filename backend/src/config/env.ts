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
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://localhost:4000/api/spotify/oauth/callback")
});

export const env = envSchema.parse(process.env);
