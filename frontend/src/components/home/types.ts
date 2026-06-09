export type HomeBoardTask = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  updatedAt?: string;
  project: { name: string };
};
