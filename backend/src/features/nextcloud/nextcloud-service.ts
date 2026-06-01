import { env } from "../../config/env.js";

export interface CloudFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string | null;
}

export interface CloudQuota {
  used: number;
  free: number;
  total: number;
  usedPercent: number | null;
  usedHuman: string;
  totalHuman: string;
}

export interface CloudStatus {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  username: string;
  quota: CloudQuota | null;
  message?: string;
}

function resolveBaseUrl(): string {
  const explicit = env.NEXTCLOUD_URL.trim() || env.HOMELAB_NEXTCLOUD_URL.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = env.HOMELAB_SERVICE_HOST.trim() || "127.0.0.1";
  const port = Number(env.HOMELAB_NEXTCLOUD_PORT) || 8081;
  return `http://${host}:${port}`;
}

export function isNextcloudConfigured(): boolean {
  return Boolean(
    resolveBaseUrl() &&
      env.NEXTCLOUD_USERNAME.trim() &&
      (env.NEXTCLOUD_APP_PASSWORD.trim() || env.NEXTCLOUD_PASSWORD.trim())
  );
}

function authHeader(): string {
  const user = env.NEXTCLOUD_USERNAME.trim();
  const pass = env.NEXTCLOUD_APP_PASSWORD.trim() || env.NEXTCLOUD_PASSWORD.trim();
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

/** Normalize user-relative path (no leading slash, no .. segments). */
export function normalizeCloudPath(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) return "";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error("Invalid path");
  }
  return parts.join("/");
}

function webdavRoot(): string {
  const base = resolveBaseUrl();
  const user = encodeURIComponent(env.NEXTCLOUD_USERNAME.trim());
  return `${base}/remote.php/dav/files/${user}`;
}

function webdavUrl(relativePath: string): string {
  const root = webdavRoot();
  if (!relativePath) return `${root}/`;
  const encoded = relativePath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${root}/${encoded}`;
}

async function nextcloudFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15_000, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", authHeader());
  return fetch(url, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function decodeHref(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function davFilesPrefix(): string {
  const user = env.NEXTCLOUD_USERNAME.trim();
  return `/remote.php/dav/files/${user}/`;
}

function hrefToRelative(href: string): string {
  const decoded = decodeHref(href);
  const pathOnly = decoded.startsWith("http") ? new URL(decoded).pathname : decoded;
  const prefix = davFilesPrefix();
  if (!pathOnly.startsWith(prefix)) return "";
  return pathOnly.slice(prefix.length).replace(/\/+$/, "");
}

function parsePropfind(xml: string, parentPath: string): CloudFileEntry[] {
  const entries: CloudFileEntry[] = [];
  const blocks = xml.match(/<(?:[a-zA-Z0-9]+:)?response[\s\S]*?<\/(?:[a-zA-Z0-9]+:)?response>/gi) ?? [];

  for (const block of blocks) {
    const hrefMatch = block.match(/<(?:[a-zA-Z0-9]+:)?href>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?href>/i);
    if (!hrefMatch) continue;
    const rel = hrefToRelative(hrefMatch[1].trim());
    if (rel === parentPath.replace(/\/+$/, "")) continue;

    const isCollection = /<(?:[a-zA-Z0-9]+:)?collection[\s/>]/i.test(block);
    const sizeMatch = block.match(/<(?:[a-zA-Z0-9]+:)?getcontentlength>(\d+)<\//i);
    const modifiedMatch = block.match(/<(?:[a-zA-Z0-9]+:)?getlastmodified>([^<]+)<\//i);
    const name = rel.split("/").pop() ?? rel;

    entries.push({
      name,
      path: rel,
      isDirectory: isCollection,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      modified: modifiedMatch ? modifiedMatch[1] : null
    });
  }

  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function getCloudQuota(): Promise<CloudQuota | null> {
  if (!isNextcloudConfigured()) return null;
  const base = resolveBaseUrl();
  const res = await nextcloudFetch(`${base}/ocs/v1.php/cloud/user?format=json`, {
    headers: { "OCS-APIRequest": "true", Accept: "application/json" }
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    ocs?: { data?: { quota?: { used?: number; free?: number; total?: number } } };
  };
  const q = json.ocs?.data?.quota;
  if (!q) return null;
  const used = Number(q.used ?? 0);
  const free = Number(q.free ?? 0);
  const total = Number(q.total ?? 0);
  const effectiveTotal = total > 0 ? total : free > 0 ? used + free : 0;
  const usedPercent =
    effectiveTotal > 0 ? Math.round((used / effectiveTotal) * 1000) / 10 : null;
  return {
    used,
    free: free > 0 ? free : 0,
    total: effectiveTotal,
    usedPercent,
    usedHuman: formatBytes(used),
    totalHuman: effectiveTotal > 0 ? formatBytes(effectiveTotal) : "Unlimited"
  };
}

export async function getCloudStatus(): Promise<CloudStatus> {
  const baseUrl = resolveBaseUrl();
  const username = env.NEXTCLOUD_USERNAME.trim();
  if (!isNextcloudConfigured()) {
    return {
      configured: false,
      connected: false,
      baseUrl,
      username,
      quota: null,
      message: "Set NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_APP_PASSWORD in api.env"
    };
  }

  try {
    const res = await nextcloudFetch(`${baseUrl}/status.php`);
    if (!res.ok) {
      return {
        configured: true,
        connected: false,
        baseUrl,
        username,
        quota: null,
        message: `Nextcloud status HTTP ${res.status}`
      };
    }
    const quota = await getCloudQuota();
    return { configured: true, connected: true, baseUrl, username, quota };
  } catch (e) {
    return {
      configured: true,
      connected: false,
      baseUrl,
      username,
      quota: null,
      message: e instanceof Error ? e.message : "Unreachable"
    };
  }
}

export async function listCloudFiles(relativePath: string): Promise<CloudFileEntry[]> {
  const path = normalizeCloudPath(relativePath);
  const url = webdavUrl(path);
  const res = await nextcloudFetch(url, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      "Content-Type": "application/xml",
      Accept: "*/*"
    },
    body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`List failed: HTTP ${res.status}`);
  }
  const xml = await res.text();
  return parsePropfind(xml, path);
}

export async function downloadCloudFile(relativePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const path = normalizeCloudPath(relativePath);
  if (!path) throw new Error("File path required");
  const res = await nextcloudFetch(webdavUrl(path), { method: "GET", timeoutMs: 120_000 });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

export async function uploadCloudFile(
  directoryPath: string,
  fileName: string,
  body: Buffer,
  contentType?: string
): Promise<{ path: string }> {
  const dir = normalizeCloudPath(directoryPath);
  const safeName = fileName.replace(/[/\\]/g, "_").trim();
  if (!safeName) throw new Error("File name required");
  const relativePath = dir ? `${dir}/${safeName}` : safeName;
  const res = await nextcloudFetch(webdavUrl(relativePath), {
    method: "PUT",
    headers: {
      "Content-Type": contentType ?? "application/octet-stream",
      "Content-Length": String(body.length)
    },
    body: new Uint8Array(body),
    timeoutMs: 300_000
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Upload failed: HTTP ${res.status}`);
  }
  return { path: relativePath };
}

export async function deleteCloudPath(relativePath: string): Promise<void> {
  const path = normalizeCloudPath(relativePath);
  if (!path) throw new Error("Path required");
  const res = await nextcloudFetch(webdavUrl(path), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete failed: HTTP ${res.status}`);
  }
}

export function getNextcloudOpenUrl(): string {
  return resolveBaseUrl();
}
