import { z } from "zod";

export const taskStatusQuerySchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional()
});

export const notionSearchQuerySchema = z.object({
  q: z.string().max(500).optional().default("")
});

export const oauthCallbackQuerySchema = z.object({
  error: z.string().max(300).optional(),
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(4096).optional()
});

export const spotifyPlaybackActionSchema = z.object({
  action: z.enum(["play", "pause", "next", "previous"])
});
