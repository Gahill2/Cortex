import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { env } from "../../config/env.js";

const execFileAsync = promisify(execFile);

export interface AppendToVaultOptions {
  vaultPath: string;
  vaultName?: string;
  relativePath: string;
  content: string;
  useDailyNote?: boolean;
}

async function obsidianOnPath(): Promise<boolean> {
  try {
  if (process.platform === "win32") {
      await execFileAsync("where", ["obsidian"], { timeout: 3_000 });
    } else {
      await execFileAsync("which", ["obsidian"], { timeout: 3_000 });
    }
    return true;
  } catch {
    return false;
  }
}

async function appendViaCli(options: AppendToVaultOptions): Promise<boolean> {
  const vaultName = options.vaultName || path.basename(options.vaultPath);
  const subcommand = options.useDailyNote ? "daily:append" : "append";
  const args = [`vault="${vaultName}"`, subcommand, `content=${options.content}`];
  if (!options.useDailyNote) {
    args.splice(2, 0, `file="${options.relativePath.replace(/\\/g, "/")}"`);
  }
  await execFileAsync("obsidian", args, { timeout: 15_000, shell: true });
  return true;
}

async function appendViaFs(options: AppendToVaultOptions): Promise<void> {
  const rel = options.relativePath.endsWith(".md") ? options.relativePath : `${options.relativePath}.md`;
  const vaultRoot = path.resolve(options.vaultPath);
  const full = path.resolve(vaultRoot, rel.replace(/\\/g, "/"));
  if (!full.startsWith(vaultRoot + path.sep) && full !== vaultRoot) {
    throw new Error("Invalid vault path");
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  if (existsSync(full)) {
    await fs.appendFile(full, "\n" + options.content, "utf8");
  } else {
    await fs.writeFile(full, options.content, "utf8");
  }
}

export async function appendToVault(options: AppendToVaultOptions): Promise<{ method: "cli" | "fs" }> {
  const useCli = env.OBSIDIAN_USE_CLI;
  if (useCli && (await obsidianOnPath())) {
    try {
      await appendViaCli(options);
      return { method: "cli" };
    } catch {
      /* fall through to filesystem */
    }
  }
  if (options.useDailyNote) {
    const today = new Date().toISOString().slice(0, 10);
    await appendViaFs({ ...options, relativePath: `${today}.md` });
  } else {
    await appendViaFs(options);
  }
  return { method: "fs" };
}
