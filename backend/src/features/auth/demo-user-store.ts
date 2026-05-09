import bcrypt from "bcrypt";
import { env } from "../../config/env.js";

export type DemoUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  pinHash: string;
};

export class DemoUserStore {
  private readonly userId = "demo-user";
  private cachedUserPromise?: Promise<DemoUserRecord>;

  getDemoUser(): Promise<DemoUserRecord> {
    if (!this.cachedUserPromise) {
      this.cachedUserPromise = Promise.all([
        bcrypt.hash(env.CORTEX_DEMO_USER_PASSWORD, 10),
        bcrypt.hash(env.CORTEX_DEMO_USER_PIN, 10)
      ]).then(([passwordHash, pinHash]) => ({
        id: this.userId,
        email: env.CORTEX_DEMO_USER_EMAIL,
        passwordHash,
        pinHash
      }));
    }

    return this.cachedUserPromise;
  }
}

export const demoUserStore = new DemoUserStore();
