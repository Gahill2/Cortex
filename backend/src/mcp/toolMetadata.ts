/** Static catalog for list_available_cortex_tools and UI hints. */
export const CORTEX_MCP_TOOL_CATALOG: Array<{ name: string; description: string }> = [
  {
    name: "get_cortex_status",
    description: "Returns Cortex name, MCP status, available modules, and server time (read-only).",
  },
  {
    name: "create_task_note",
    description: "Saves a personal task note (title + description) to a local JSON file on the PC. Does not sync to Prisma/tasks API.",
  },
  {
    name: "recommend_music_seed",
    description: "Returns mock sample track ideas from mood/genre/activity (no Spotify calls).",
  },
  {
    name: "draft_email_template",
    description: "Returns a draft email body only — does not send mail.",
  },
  {
    name: "list_available_cortex_tools",
    description: "Lists all registered Cortex MCP tools and short descriptions.",
  },
];

export const CORTEX_MCP_MODULES = [
  "tasks (MCP notes file)",
  "mail (draft templates only in MCP)",
  "music (mock recommendations in MCP)",
  "api (main Cortex backend on separate port)",
] as const;
