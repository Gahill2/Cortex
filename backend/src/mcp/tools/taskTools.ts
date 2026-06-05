import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type TaskNote = { id: string; title: string; description: string; createdAt: string };

async function readNotes(filePath: string): Promise<TaskNote[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as TaskNote[]) : [];
  } catch {
    return [];
  }
}

export function registerTaskTools(server: McpServer, notesFilePath: string): void {
  server.registerTool(
    "create_task_note",
    {
      description:
        "Append a personal task note to local JSON (Phase 2). Use sample/fake titles while testing. Not wired to Cortex Prisma tasks.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Short title for the note"),
        description: z.string().max(4000).optional().default("").describe("Optional body text"),
      },
    },
    async ({ title, description }) => {
      await fs.mkdir(path.dirname(notesFilePath), { recursive: true });
      const list = await readNotes(notesFilePath);
      const note: TaskNote = {
        id: `note_${Date.now()}`,
        title,
        description: description ?? "",
        createdAt: new Date().toISOString(),
      };
      list.push(note);
      await fs.writeFile(notesFilePath, JSON.stringify(list, null, 2), "utf8");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ saved: true, note }, null, 2),
          },
        ],
      };
    }
  );
}
