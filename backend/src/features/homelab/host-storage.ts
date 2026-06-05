import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";

const execFileAsync = promisify(execFile);

export interface DiskUsage {
  mount: string;
  label: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  totalHuman: string;
  usedHuman: string;
  freeHuman: string;
}

export interface NasFolderUsage {
  name: string;
  sizeBytes: number;
  sizeHuman: string;
}

export interface HostStorageStatus {
  available: boolean;
  systemDisk: DiskUsage | null;
  nasRoot: string | null;
  nasTotalBytes: number | null;
  nasTotalHuman: string | null;
  nasFolders: NasFolderUsage[];
  downloadHeadroomHuman: string | null;
  message?: string;
}

let cachedAt = 0;
let cached: HostStorageStatus | null = null;
const CACHE_MS = 60_000;

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

function statDisk(mountPath: string, label: string): DiskUsage | null {
  try {
    const st = fs.statfsSync(mountPath);
    const totalBytes = st.bsize * st.blocks;
    const freeBytes = st.bsize * st.bavail;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
    return {
      mount: mountPath,
      label,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent,
      totalHuman: formatBytes(totalBytes),
      usedHuman: formatBytes(usedBytes),
      freeHuman: formatBytes(freeBytes),
    };
  } catch {
    return null;
  }
}

async function folderSizes(root: string): Promise<NasFolderUsage[]> {
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }

  const folders: NasFolderUsage[] = [];
  for (const name of entries) {
    const full = path.join(root, name);
    try {
      const st = fs.statSync(full);
      if (!st.isDirectory()) continue;
      const { stdout } = await execFileAsync("du", ["-sb", full], { timeout: 30_000 });
      const sizeBytes = Number(stdout.trim().split(/\s+/)[0] ?? 0);
      folders.push({ name, sizeBytes, sizeHuman: formatBytes(sizeBytes) });
    } catch {
      folders.push({ name, sizeBytes: 0, sizeHuman: "—" });
    }
  }

  return folders.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

export async function getHostStorageStatus(opts?: { light?: boolean }): Promise<HostStorageStatus> {
  const light = opts?.light === true;
  if (!light && cached && Date.now() - cachedAt < CACHE_MS) return cached;

  const nasRoot = env.HOMELAB_NAS_ROOT.trim() || null;
  const systemDisk = statDisk(nasRoot ?? "/", nasRoot ? "NAS volume" : "System disk");

  if (!systemDisk) {
    const result: HostStorageStatus = {
      available: false,
      systemDisk: null,
      nasRoot,
      nasTotalBytes: null,
      nasTotalHuman: null,
      nasFolders: [],
      downloadHeadroomHuman: null,
      message: "Could not read disk usage",
    };
    if (!light) {
      cached = result;
      cachedAt = Date.now();
    }
    return result;
  }

  let nasFolders: NasFolderUsage[] = [];
  if (!light && nasRoot && fs.existsSync(nasRoot)) {
    nasFolders = await folderSizes(nasRoot);
  }

  const nasTotalBytes = nasFolders.reduce((sum, f) => sum + f.sizeBytes, 0);

  const result: HostStorageStatus = {
    available: true,
    systemDisk,
    nasRoot,
    nasTotalBytes: nasFolders.length > 0 ? nasTotalBytes : null,
    nasTotalHuman: nasFolders.length > 0 ? formatBytes(nasTotalBytes) : null,
    nasFolders,
    downloadHeadroomHuman: systemDisk.freeHuman,
    message: nasRoot && !fs.existsSync(nasRoot)
      ? `NAS path not mounted in API container (${nasRoot})`
      : undefined,
  };

  if (!light) {
    cached = result;
    cachedAt = Date.now();
  }
  return result;
}
