import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CORTEX_MCP_MODULES, CORTEX_MCP_TOOL_CATALOG } from "../toolMetadata.js";

export function registerSystemTools(server: McpServer): void {
  server.registerTool(
    "get_cortex_status",
    {
      description:
        "Read-only status: app name, MCP server, advertised modules, ISO timestamp. Safe for automation checks.",
    },
    async () => {
      const payload = {
        app: "Cortex",
        mcp_server: "running",
        modules: [...CORTEX_MCP_MODULES],
        tool_count: CORTEX_MCP_TOOL_CATALOG.length,
        timestamp: new Date().toISOString(),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      };
    }
  );

  server.registerTool(
    "list_available_cortex_tools",
    {
      description: "Returns every MCP tool name and its short description.",
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ tools: CORTEX_MCP_TOOL_CATALOG }, null, 2),
        },
      ],
    })
  );
}
