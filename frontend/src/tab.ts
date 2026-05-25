/** App tab ids — keep in a separate module so lazy routes never import App.tsx. */
export type Tab =
  | "home"
  | "tasks"
  | "ai"
  | "notes"
  | "settings"
  | "spotify"
  | "mail";
