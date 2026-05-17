/**
 * Standalone Cortex MCP (Streamable HTTP). Run from backend root:
 *   npm run mcp:dev
 *
 * Loads backend/.env via dotenv (same pattern as main API).
 */
import "dotenv/config";
import { loadMcpConfig } from "./mcpConfig.js";
import { buildMcpExpressApp } from "./mcpHttpApp.js";

const config = loadMcpConfig();
const app = buildMcpExpressApp(config);

app.listen(config.port, config.listenHost, () => {
  console.log(
    `[cortex-mcp] Streamable HTTP — POST http://${config.listenHost}:${config.port}/mcp (mode=${config.mode})`
  );
  console.log(`[cortex-mcp] Health — GET http://${config.listenHost}:${config.port}/health`);
  if (config.mode === "tailscale") {
    console.log(
      "[cortex-mcp] Tailscale: Host header allows loopback, CORTEX_MCP_ALLOWED_HOSTS, " +
        (config.allowTailscaleCidr ? "100.64.0.0/10 IPv4, " : "") +
        (config.allowTailscaleNames ? "MagicDNS (*.ts.net)." : "")
    );
    if (!config.strictCors) {
      console.log("[cortex-mcp] CORS: relaxed for Tailscale origins (set CORTEX_MCP_STRICT_CORS=1 to lock down).");
    }
    console.log(
      "[cortex-mcp] On your phone (same Tailscale account): use http://<this-PC-Tailscale-IP>:" +
        config.port +
        " — find IP in Tailscale admin or `tailscale ip -4` on this PC."
    );
  }
});
