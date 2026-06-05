import fs from "fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { env } from "../../config/env.js";
import { cortexDataPath } from "../../lib/cortex-data-dir.js";

const SIDECAR = cortexDataPath("obsidian-vaults.json");

export async function getVaults(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(SIDECAR, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function saveVaults(v: Record<string, string>): Promise<void> {
  await fs.writeFile(SIDECAR, JSON.stringify(v), "utf8");
}

export async function resolveVaultPathForUser(
  userId: string,
  options: { autoBind?: boolean } = {}
): Promise<string | null> {
  const vaults = await getVaults();
  const userPath = vaults[userId]?.trim();
  if (userPath && existsSync(userPath)) {
    return userPath;
  }

  const envPath = env.OBSIDIAN_VAULT_PATH?.trim();
  if (envPath && existsSync(envPath)) {
    if (options.autoBind && !userPath) {
      vaults[userId] = envPath;
      await saveVaults(vaults);
    }
    return envPath;
  }

  return userPath || null;
}
