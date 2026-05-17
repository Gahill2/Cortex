import path from "node:path";
import { z } from "zod";

const modeSchema = z.enum(["local", "tailscale"]);

const mcpEnvSchema = z.object({
  CORTEX_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORTEX_MCP_MODE: modeSchema.default("local"),
  /** Listen address (passed to server.listen). */
  CORTEX_MCP_HOST: z.string().optional(),
  /**
   * Hostnames allowed in the HTTP Host header when binding to all interfaces.
   * Comma-separated, no ports. Include your Tailscale IP (e.g. 100.x.x.x) for phone clients.
   */
  CORTEX_MCP_ALLOWED_HOSTS: z.string().optional().default(""),
  /** JSON file for create_task_note (Phase 2 local notes, not Prisma tasks). */
  CORTEX_MCP_NOTES_PATH: z.string().optional().default(""),
  /** Origins allowed to call GET /health (browser UI). */
  CORTEX_MCP_CORS_ORIGINS: z.string().optional().default("http://localhost:5173,http://127.0.0.1:5173"),
  /**
   * In tailscale mode: allow Host header for 100.64.0.0/10 (Tailscale IPv4) without listing each IP.
   * Set to 0 to require every hostname in CORTEX_MCP_ALLOWED_HOSTS (strict).
   */
  CORTEX_MCP_ALLOW_TAILSCALE_CIDR: z.enum(["0", "1"]).default("1"),
  /** In tailscale mode: allow *.ts.net / *.tailscale.net hostnames (MagicDNS). */
  CORTEX_MCP_ALLOW_TAILSCALE_NAMES: z.enum(["0", "1"]).default("1"),
  /**
   * In tailscale mode: allow browser CORS from any Tailscale CGNAT / MagicDNS origin (so phone → PC works).
   * Set CORTEX_MCP_STRICT_CORS=1 to only use CORTEX_MCP_CORS_ORIGINS.
   */
  CORTEX_MCP_STRICT_CORS: z.enum(["0", "1"]).default("0"),
});

export type CortexMcpMode = z.infer<typeof modeSchema>;

export type CortexMcpConfig = {
  port: number;
  mode: CortexMcpMode;
  listenHost: string;
  allowedHosts: string[];
  allowTailscaleCidr: boolean;
  allowTailscaleNames: boolean;
  strictCors: boolean;
  notesFilePath: string;
  corsOrigins: string[];
};

function parseAllowedHosts(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadMcpConfig(): CortexMcpConfig {
  const parsed = mcpEnvSchema.parse(process.env);
  const mode = parsed.CORTEX_MCP_MODE;
  const defaultNotes =
    parsed.CORTEX_MCP_NOTES_PATH || path.join(process.cwd(), "data", "mcp-task-notes.json");

  let corsOrigins = parseAllowedHosts(parsed.CORTEX_MCP_CORS_ORIGINS);
  const fe = process.env.CORTEX_FRONTEND_URL?.trim();
  if (fe) {
    corsOrigins = [...new Set([...corsOrigins, fe])];
  }

  const allowTailscaleCidr = parsed.CORTEX_MCP_ALLOW_TAILSCALE_CIDR === "1";
  const allowTailscaleNames = parsed.CORTEX_MCP_ALLOW_TAILSCALE_NAMES === "1";
  const strictCors = parsed.CORTEX_MCP_STRICT_CORS === "1";

  if (mode === "local") {
    const listenHost = parsed.CORTEX_MCP_HOST || "127.0.0.1";
    return {
      port: parsed.CORTEX_MCP_PORT,
      mode,
      listenHost,
      allowedHosts: [],
      allowTailscaleCidr: false,
      allowTailscaleNames: false,
      strictCors: true,
      notesFilePath: defaultNotes,
      corsOrigins,
    };
  }

  const listenHost = parsed.CORTEX_MCP_HOST || "0.0.0.0";
  const allowed = parseAllowedHosts(parsed.CORTEX_MCP_ALLOWED_HOSTS);
  const merged =
    allowed.length > 0
      ? allowed
      : ["localhost", "127.0.0.1"];

  return {
    port: parsed.CORTEX_MCP_PORT,
    mode,
    listenHost,
    allowedHosts: merged,
    allowTailscaleCidr,
    allowTailscaleNames,
    strictCors,
    notesFilePath: defaultNotes,
    corsOrigins,
  };
}
