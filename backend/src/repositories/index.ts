import { PrismaSettingsRepository } from "./prisma-settings.repository.js";
import type { SettingsRepository } from "./interfaces.js";

export type { SettingsRepository, UserSettingsData } from "./interfaces.js";
export type { TaskRepository, TaskData } from "./interfaces.js";

/**
 * Singleton repositories — swap implementations here when migrating
 * to Firestore (DATA_BACKEND=firestore flag from Phase 0 roadmap).
 */
export const settingsRepo: SettingsRepository = new PrismaSettingsRepository();
