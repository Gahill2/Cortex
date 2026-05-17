import { createHash, randomBytes } from "crypto";

type Row = { userId: string; codeVerifier: string; expiresAt: number };

const store = new Map<string, Row>();
const TTL_MS = 10 * 60_000;

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function createCanvaPkceSession(userId: string): { state: string; codeVerifier: string } {
  sweep();
  const codeVerifier = randomBytes(72).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  store.set(state, { userId, codeVerifier, expiresAt: Date.now() + TTL_MS });
  return { state, codeVerifier };
}

export function buildCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
}

export function takeCanvaPkceSession(state: string): Row | null {
  sweep();
  const row = store.get(state);
  if (!row) return null;
  store.delete(state);
  if (row.expiresAt <= Date.now()) return null;
  return row;
}
