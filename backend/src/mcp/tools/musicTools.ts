import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const MOCK_POOL = [
  { title: "Neon Drift (sample)", artist: "Cortex Mock Ensemble", vibe: "focus" },
  { title: "Quiet Hours (sample)", artist: "Cortex Mock Ensemble", vibe: "wind down" },
  { title: "Pulse Check (sample)", artist: "Cortex Mock Ensemble", vibe: "energy" },
];

export function registerMusicTools(server: McpServer): void {
  server.registerTool(
    "recommend_music_seed",
    {
      description:
        "Returns a short mock playlist seed from mood/genre/activity. No Spotify or external APIs.",
      inputSchema: {
        mood: z.string().max(120).optional().describe("e.g. calm, hype, melancholy"),
        genre: z.string().max(120).optional().describe("e.g. electronic, jazz"),
        activity: z.string().max(120).optional().describe("e.g. coding, commute"),
      },
    },
    async (args) => {
      const picks = MOCK_POOL.map((t, i) => ({
        rank: i + 1,
        ...t,
        matched: args,
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                disclaimer: "Sample data only — connect Spotify in the Cortex app for real playback later.",
                recommendations: picks,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
