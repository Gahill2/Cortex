import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CortexMcpConfig } from "./mcpConfig.js";
import { registerEmailTools } from "./tools/emailTools.js";
import { registerMusicTools } from "./tools/musicTools.js";
import { registerSystemTools } from "./tools/systemTools.js";
import { registerTaskTools } from "./tools/taskTools.js";

/** New server instance per HTTP request (stateless streamable HTTP pattern). */
export function createCortexMcpServer(config: CortexMcpConfig): McpServer {
  const server = new McpServer(
    { name: "cortex-mcp", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Cortex personal MCP — safe starter tools only. No outbound email send, no Spotify calls. Expand later with authenticated bridges.",
    }
  );

  registerSystemTools(server);
  registerTaskTools(server, config.notesFilePath);
  registerMusicTools(server);
  registerEmailTools(server);

  return server;
}
