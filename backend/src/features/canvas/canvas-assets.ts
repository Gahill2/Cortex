import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "../../utils/http-error.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ASSETS_ROOT = join(backendRoot, "data", "canvas-assets");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const MAX_BYTES = 8 * 1024 * 1024;

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;,]+)?(?:;base64)?,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new HttpError(400, "Invalid image data URL");
  const mime = (match[1] || "image/png").toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) {
    throw new HttpError(413, "Image exceeds 8MB limit");
  }
  return { mime, buffer };
}

function assetPath(userId: string, assetId: string, ext: string) {
  return join(ASSETS_ROOT, userId, `${assetId}.${ext}`);
}

export async function saveCanvasImageFromDataUrl(
  userId: string,
  dataUrl: string
): Promise<{ assetId: string; mime: string }> {
  const { mime, buffer } = parseDataUrl(dataUrl);
  const ext = MIME_EXT[mime] ?? "png";
  const assetId = randomUUID();
  const path = assetPath(userId, assetId, ext);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return { assetId, mime };
}

export async function readCanvasImage(
  userId: string,
  assetId: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!/^[a-f0-9-]{36}$/i.test(assetId)) return null;
  for (const ext of Object.keys(EXT_MIME)) {
    try {
      const buffer = await readFile(assetPath(userId, assetId, ext));
      return { buffer, mime: EXT_MIME[ext] ?? "application/octet-stream" };
    } catch {
      /* try next ext */
    }
  }
  return null;
}

export function assetIdFromImageUrl(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  const match = /\/canvas\/images\/([a-f0-9-]{36})$/i.exec(imageUrl);
  return match?.[1] ?? null;
}

export function hashCanvasLayout(layout: unknown): string {
  return createHash("sha256").update(JSON.stringify(layout ?? null)).digest("hex");
}
