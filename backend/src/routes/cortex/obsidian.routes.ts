import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const obsidianRouter = Router();

// In-memory vault path store per user (persisted via simple JSON sidecar)
const SIDECAR = path.join(process.cwd(), "obsidian-vaults.json");

export async function getVaults(): Promise<Record<string, string>> {
  try { return JSON.parse(await fs.readFile(SIDECAR, "utf8")); } catch { return {}; }
}
async function saveVaults(v: Record<string, string>) {
  await fs.writeFile(SIDECAR, JSON.stringify(v), "utf8");
}

/** Recent vault snippets for AI / integrations (no HTTP). */
export async function getObsidianContextForUser(userId: string): Promise<string> {
  const vaults = await getVaults();
  const vaultPath = vaults[userId];
  if (!vaultPath) return "";

  const files: Array<{ name: string; path: string; modified: number }> = [];
  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!entry.name.endsWith(".md")) continue;
        const stat = await fs.stat(full);
        files.push({ name: entry.name.replace(/\.md$/, ""), path: full, modified: stat.mtimeMs });
      }
    } catch {
      /* skip */
    }
  }
  await walk(vaultPath);
  files.sort((a, b) => b.modified - a.modified);
  const top = files.slice(0, 5);
  const snippets = await Promise.all(
    top.map(async (f) => {
      const content = await fs.readFile(f.path, "utf8").catch(() => "");
      return `## ${f.name} (Obsidian)\n${content.slice(0, 500)}`;
    })
  );
  return snippets.join("\n\n---\n\n");
}

// GET /obsidian/vault — get configured vault path
obsidianRouter.get("/vault", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaults = await getVaults();
  sendSuccess(res, { path: vaults[userId] ?? null });
});

// POST /obsidian/vault — set vault path
obsidianRouter.post("/vault", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const { path: vaultPath } = z.object({ path: z.string().min(1) }).parse(req.body);
  if (!existsSync(vaultPath)) throw new HttpError(400, "Path does not exist on this machine");
  const vaults = await getVaults();
  vaults[userId] = vaultPath;
  await saveVaults(vaults);
  sendSuccess(res, { path: vaultPath });
});

// GET /obsidian/files — list all .md files in vault
obsidianRouter.get("/files", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaults = await getVaults();
  const vaultPath = vaults[userId];
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const files: Array<{ name: string; path: string; modified: number; size: number }> = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.name.endsWith(".md")) {
          const stat = await fs.stat(full);
          files.push({
            name: entry.name.replace(/\.md$/, ""),
            path: path.relative(vaultPath, full).replace(/\\/g, "/"),
            modified: stat.mtimeMs,
            size: stat.size,
          });
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(vaultPath);
  files.sort((a, b) => b.modified - a.modified);
  sendSuccess(res, { files: files.slice(0, 200) });
});

// GET /obsidian/file?path= — read file content
obsidianRouter.get("/file", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaults = await getVaults();
  const vaultPath = vaults[userId];
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const filePath = z.string().min(1).parse(req.query.path as string);
  const full = path.join(vaultPath, filePath);
  // Prevent path traversal
  if (!full.startsWith(vaultPath)) throw new HttpError(403, "Forbidden");

  const content = await fs.readFile(full, "utf8");
  sendSuccess(res, { content, path: filePath });
});

// POST /obsidian/file — create or update a file
obsidianRouter.post("/file", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const vaults = await getVaults();
  const vaultPath = vaults[userId];
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const { path: filePath, content, append } = z.object({
    path: z.string().min(1),
    content: z.string(),
    append: z.boolean().optional().default(false),
  }).parse(req.body);

  const full = path.join(vaultPath, filePath.endsWith(".md") ? filePath : filePath + ".md");
  if (!full.startsWith(vaultPath)) throw new HttpError(403, "Forbidden");

  await fs.mkdir(path.dirname(full), { recursive: true });
  if (append && existsSync(full)) {
    await fs.appendFile(full, "\n" + content, "utf8");
  } else {
    await fs.writeFile(full, content, "utf8");
  }
  sendSuccess(res, { path: path.relative(vaultPath, full).replace(/\\/g, "/") });
});

// GET /obsidian/search?q= — search file names and content
obsidianRouter.get("/search", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaults = await getVaults();
  const vaultPath = vaults[userId];
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const q = z.string().min(1).max(200).parse(req.query.q as string).toLowerCase();
  const results: Array<{ name: string; path: string; excerpt: string }> = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walk(full); continue; }
        if (!entry.name.endsWith(".md")) continue;
        const name = entry.name.replace(/\.md$/, "");
        const rel = path.relative(vaultPath, full).replace(/\\/g, "/");
        if (name.toLowerCase().includes(q)) {
          results.push({ name, path: rel, excerpt: "" });
        } else {
          const content = await fs.readFile(full, "utf8").catch(() => "");
          const idx = content.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 60);
            results.push({ name, path: rel, excerpt: "…" + content.slice(start, start + 120) + "…" });
          }
        }
        if (results.length >= 20) return;
      }
    } catch { /* skip */ }
  }

  await walk(vaultPath);
  sendSuccess(res, { results });
});

// GET /obsidian/context — recent + pinned files for AI context
obsidianRouter.get("/context", requireAuth, async (req, res) => {
  const ctx = await getObsidianContextForUser(req.auth!.userId);
  sendSuccess(res, { context: ctx });
});
