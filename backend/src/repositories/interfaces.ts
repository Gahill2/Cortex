/**
 * Repository interfaces — backend-agnostic data access contracts.
 * Prisma implements these today; Firestore can implement them later
 * behind a `DATA_BACKEND=firestore` flag (Phase 0 roadmap).
 */

export interface UserSettingsData {
  userId: string;
  appearance: string;
  wallpaper: Record<string, unknown> | null;
  aiTheme: Record<string, unknown> | null;
  weatherCity: string | null;
  weatherUnits: string;
  homeGoals: unknown[] | null;
  pinHash: string | null;
  canvasLayout: unknown | null;
  extraJson: Record<string, unknown> | null;
}

export interface SettingsRepository {
  get(userId: string): Promise<UserSettingsData | null>;
  upsert(userId: string, data: Partial<Omit<UserSettingsData, "userId">>): Promise<UserSettingsData>;
}

export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  organizationId: string;
  projectId: string;
  assigneeId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRepository {
  findByOrg(orgId: string, filters?: { status?: string }): Promise<TaskData[]>;
  findById(id: string, orgId: string): Promise<TaskData | null>;
  create(data: Omit<TaskData, "id" | "createdAt" | "updatedAt">): Promise<TaskData>;
  update(id: string, data: Partial<Pick<TaskData, "title" | "description" | "status" | "priority" | "dueDate" | "assigneeId">>): Promise<TaskData>;
  delete(id: string): Promise<void>;
}
