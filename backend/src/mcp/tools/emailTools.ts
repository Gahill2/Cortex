import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerEmailTools(server: McpServer): void {
  server.registerTool(
    "draft_email_template",
    {
      description:
        "Builds a plain-text email draft from recipient context, purpose, and tone. Does not send or read mail.",
      inputSchema: {
        recipient_context: z
          .string()
          .max(500)
          .describe("Who they are / relationship (use fictitious names while testing)"),
        purpose: z.string().max(500).describe("Why you are writing"),
        tone: z.string().max(120).optional().default("professional").describe("e.g. friendly, formal, brief"),
      },
    },
    async ({ recipient_context, purpose, tone }) => {
      const draft = [
        `Hi,`,
        ``,
        `I hope you are doing well. I am writing regarding: ${purpose}`,
        ``,
        `Context: ${recipient_context}`,
        ``,
        `Thanks,`,
        `[Your name]`,
      ].join("\n");

      const body = [
        `Tone: ${tone}`,
        ``,
        `--- Draft (do not send from MCP) ---`,
        draft,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: body }],
      };
    }
  );
}
