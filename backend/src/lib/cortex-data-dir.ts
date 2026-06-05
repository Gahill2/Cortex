import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Host: `backend/data`. Docker homelab: `/app/data` via `CORTEX_API_DATA_DIR`. */
export function cortexDataRoot(): string {
  const fromEnv = env.CORTEX_API_DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(backendRoot, "data");
}

export function cortexDataPath(...segments: string[]): string {
  return join(cortexDataRoot(), ...segments);
}
