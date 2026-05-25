import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { sendSuccess } from "../../utils/api-response.js";
import { HttpError } from "../../utils/http-error.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { buildVaultGraph } from "../../features/obsidian/vault-graph.js";
import { getVaultBacklinks } from "../../features/obsidian/vault-backlinks.js";
import { appendToVault } from "../../features/obsidian/obsidian-cli.js";
import { getVaults, resolveVaultPathForUser, saveVaults } from "../../features/obsidian/vault-store.js";
import { env } from "../../config/env.js";

export const obsidianRouter = Router();

export { getVaults, resolveVaultPathForUser };

/** Recent vault snippets for AI / integrations (no HTTP). */
export async function getObsidianContextForUser(userId: string): Promise<string> {
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
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

function vaultDisplayName(vaultPath: string): string {
  if (env.OBSIDIAN_VAULT_NAME?.trim()) return env.OBSIDIAN_VAULT_NAME.trim();
  return path.basename(vaultPath);
}

// GET /obsidian/vault — get configured vault path
obsidianRouter.get("/vault", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  sendSuccess(res, {
    path: vaultPath,
    name: vaultPath ? vaultDisplayName(vaultPath) : null,
    envFallback: Boolean(!((await getVaults())[userId]) && env.OBSIDIAN_VAULT_PATH && vaultPath),
  });
});

// POST /obsidian/vault — set vault path
obsidianRouter.post("/vault", requireAuth, routeRateLimit(20, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const { path: vaultPath } = z.object({ path: z.string().min(1) }).parse(req.body);
  if (!existsSync(vaultPath)) throw new HttpError(400, "Path does not exist on this machine");
  const vaults = await getVaults();
  vaults[userId] = vaultPath;
  await saveVaults(vaults);
  sendSuccess(res, { path: vaultPath, name: vaultDisplayName(vaultPath) });
});

function formatCaptureLine(text: string): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `- ${h}:${m}:${s} — ${text}\n`;
}

// POST /obsidian/capture — quick capture to daily note or inbox file
obsidianRouter.post("/capture", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const { text, target } = z
    .object({
      text: z.string().min(1).max(8000),
      target: z.enum(["daily", "inbox"]).optional().default("daily"),
    })
    .parse(req.body);

  const line = formatCaptureLine(text);
  const captureTarget = target ?? "daily";

  if (captureTarget === "daily") {
    const result = await appendToVault({
      vaultPath,
      vaultName: vaultDisplayName(vaultPath),
      relativePath: "",
      content: line,
      useDailyNote: true,
    });
    sendSuccess(res, { target: "daily", method: result.method });
    return;
  }

  const inboxRel = env.OBSIDIAN_CAPTURE_PATH.replace(/\\/g, "/");
  const result = await appendToVault({
    vaultPath,
    vaultName: vaultDisplayName(vaultPath),
    relativePath: inboxRel,
    content: line,
  });
  sendSuccess(res, { target: "inbox", path: inboxRel, method: result.method });
});

// GET /obsidian/backlinks?path= — incoming/outgoing wikilinks for a note
obsidianRouter.get("/backlinks", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const filePath = z.string().min(1).parse(req.query.path as string);
  const full = path.join(vaultPath, filePath);
  if (!full.startsWith(path.resolve(vaultPath))) throw new HttpError(403, "Forbidden");

  const backlinks = await getVaultBacklinks(vaultPath, filePath);
  sendSuccess(res, backlinks);
});

// GET /obsidian/graph — knowledge graph of wikilinks
obsidianRouter.get("/graph", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const focus = typeof req.query.focus === "string" ? req.query.focus : undefined;
  const graph = await buildVaultGraph({ vaultPath, query: q, focus });
  sendSuccess(res, graph);
});

// GET /obsidian/files — list all .md files in vault
obsidianRouter.get("/files", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const vaultRoot = path.resolve(vaultPath);
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
            path: path.relative(vaultRoot, full).replace(/\\/g, "/"),
            modified: stat.mtimeMs,
            size: stat.size,
          });
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(vaultPath);
  files.sort((a, b) => b.modified - a.modified);
  sendSuccess(res, { files: files.slice(0, 800) });
});

// GET /obsidian/file?path= — read file content
obsidianRouter.get("/file", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const filePath = z.string().min(1).parse(req.query.path as string);
  const full = path.join(vaultPath, filePath);
  if (!full.startsWith(path.resolve(vaultPath))) throw new HttpError(403, "Forbidden");

  const content = await fs.readFile(full, "utf8");
  sendSuccess(res, { content, path: filePath });
});

// POST /obsidian/file — create or update a file
obsidianRouter.post("/file", requireAuth, routeRateLimit(30, 60_000), async (req, res) => {
  const userId = req.auth!.userId;
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const { path: filePath, content, append } = z.object({
    path: z.string().min(1),
    content: z.string(),
    append: z.boolean().optional().default(false),
  }).parse(req.body);

  const full = path.join(vaultPath, filePath.endsWith(".md") ? filePath : filePath + ".md");
  if (!full.startsWith(path.resolve(vaultPath))) throw new HttpError(403, "Forbidden");

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
  const vaultPath = await resolveVaultPathForUser(userId, { autoBind: true });
  if (!vaultPath) throw new HttpError(400, "No vault configured");

  const q = z.string().min(1).max(200).parse(req.query.q as string).toLowerCase();
  const vaultRoot = path.resolve(vaultPath);
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
        const rel = path.relative(vaultRoot, full).replace(/\\/g, "/");
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
