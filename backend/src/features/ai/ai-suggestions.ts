import { prisma } from "../../db/prisma.js";
import { isSpotifyConnected } from "../spotify/spotify-token-store.js";

export type AISuggestion = {
  id: string;
  label: string;
  prompt: string;
  category: "productivity" | "music" | "homelab" | "general";
};

/** Context-aware starter prompts (Open WebUI-style suggestions, Cortex data). */
export async function getAISuggestionsForUser(userId: string): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [
    {
      id: "day-summary",
      label: "Summarize my day",
      prompt: "Summarize what I should focus on today based on my tasks and calendar.",
      category: "productivity",
    },
    {
      id: "tasks-due",
      label: "Tasks due soon",
      prompt: "What tasks are due in the next 7 days? List them by priority.",
      category: "productivity",
    },
    {
      id: "email-draft",
      label: "Draft email reply",
      prompt: "Help me draft a concise, professional email reply. Ask what thread to use if needed.",
      category: "productivity",
    },
    {
      id: "task-desc",
      label: "Write task description",
      prompt: "Help me write a clear task description with acceptance criteria.",
      category: "productivity",
    },
  ];

  const [openTasks, spotifyConnected] = await Promise.all([
    prisma.task.count({
      where: {
        OR: [{ assigneeId: userId }, { createdById: userId }],
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
    isSpotifyConfiguredAndConnected(userId),
  ]);

  if (openTasks > 0) {
    suggestions.unshift({
      id: "triage-tasks",
      label: `Triage ${openTasks} open tasks`,
      prompt: `I have ${openTasks} open tasks. Suggest an order to tackle them and what to defer.`,
      category: "productivity",
    });
  }

  if (spotifyConnected) {
    suggestions.push(
      {
        id: "spotify-playlist",
        label: "Spotify playlist idea",
        prompt:
          "Suggest a Spotify playlist theme based on my listening — upbeat focus mix with variety.",
        category: "music",
      },
      {
        id: "spotify-discover",
        label: "Discover new music",
        prompt: "Based on my taste, recommend artists or albums I might have missed.",
        category: "music",
      },
    );
  }

  suggestions.push({
    id: "homelab-check",
    label: "Homelab health",
    prompt: "What should I check on my homelab stack (Cortex, Jellyfin, Nextcloud, Pi-hole)?",
    category: "homelab",
  });

  return suggestions.slice(0, 10);
}

async function isSpotifyConfiguredAndConnected(userId: string): Promise<boolean> {
  try {
    const { isSpotifyConfigured } = await import("../spotify/spotify-service.js");
    if (!isSpotifyConfigured()) return false;
    return isSpotifyConnected(userId);
  } catch {
    return false;
  }
}
