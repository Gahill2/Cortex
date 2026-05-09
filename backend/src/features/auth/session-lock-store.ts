export class SessionLockStore {
  private readonly lockedSessions = new Set<string>();

  lock(token: string): void {
    this.lockedSessions.add(token);
  }

  unlock(token: string): void {
    this.lockedSessions.delete(token);
  }

  isLocked(token: string): boolean {
    return this.lockedSessions.has(token);
  }

  clear(): void {
    this.lockedSessions.clear();
  }
}

export const sessionLockStore = new SessionLockStore();
