import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";

export interface HomelabIcloudStatus {
  configured: boolean;
  authenticated: boolean;
  appleId: string;
  importPath: string;
  importSizeHuman: string | null;
  importFileCount: number | null;
  immichUrl: string;
  message?: string;
  setupHint?: string;
}

function nasPath(...parts: string[]): string | null {
  const root = env.HOMELAB_NAS_ROOT.trim();
  if (!root) return null;
  return path.join(root, ...parts);
}

function countFilesRecursive(dir: string, limit = 5000): number {
  let count = 0;
  const stack = [dir];
  while (stack.length > 0 && count < limit) {
    const current = stack.pop();
    if (!current) break;
    let entries: string[];
    try {
      entries = fs.readdirSync(current);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (count >= limit) break;
      const full = path.join(current, name);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) stack.push(full);
        else if (st.isFile()) count += 1;
      } catch {
        /* skip */
      }
    }
  }
  return count;
}

function folderSizeHuman(dir: string): string | null {
  try {
    const st = fs.statSync(dir);
    if (!st.isDirectory()) return null;
    // Fast estimate: empty import folder
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) return "0 B";
    return null; // defer to du via storage section for large trees
  } catch {
    return null;
  }
}

export function getIcloudStatus(): HomelabIcloudStatus {
  const appleId = env.HOMELAB_ICLOUD_APPLE_ID.trim();
  const immichHost = env.HOMELAB_IMMICH_URL.trim() || `http://${env.HOMELAB_SERVICE_HOST.trim() || "127.0.0.1"}:2283`;
  const importRel = "photos/icloud-import";
  const configRel = "appdata/icloudpd";
  const importPath = nasPath(importRel) ?? `/nas/${importRel}`;
  const configPath = nasPath(configRel);

  let authenticated = false;
  if (configPath && fs.existsSync(configPath)) {
    try {
      const entries = fs.readdirSync(configPath);
      authenticated = entries.some((e) => /cookie|session|pyicloud/i.test(e));
    } catch {
      authenticated = false;
    }
  }

  let importFileCount: number | null = null;
  let importSizeHuman: string | null = null;
  if (importPath && fs.existsSync(importPath)) {
    importFileCount = countFilesRecursive(importPath);
    importSizeHuman = folderSizeHuman(importPath);
    if (importFileCount > 0 && importSizeHuman === null) {
      importSizeHuman = `${importFileCount}+ files`;
    }
  }

  const configured = Boolean(appleId);
  const setupHint =
    "On cortex: cd deploy/nas/icloudpd && cp .env.example .env && docker compose run --rm icloudpd sync-icloud.sh --Initialise";

  if (!configured) {
    return {
      configured: false,
      authenticated: false,
      appleId: "",
      importPath,
      importSizeHuman,
      importFileCount,
      immichUrl: immichHost,
      message: "Set HOMELAB_ICLOUD_APPLE_ID in api.env and complete icloudpd login on the host",
      setupHint,
    };
  }

  if (!authenticated) {
    return {
      configured: true,
      authenticated: false,
      appleId,
      importPath,
      importSizeHuman,
      importFileCount,
      immichUrl: immichHost,
      message: "Apple login not completed — run icloudpd --Initialise once (2FA required)",
      setupHint,
    };
  }

  return {
    configured: true,
    authenticated: true,
    appleId,
    importPath,
    importSizeHuman,
    importFileCount,
    immichUrl: immichHost,
    message:
      importFileCount && importFileCount > 0
        ? "Photos syncing to local import folder — wire Immich external library if needed"
        : "Authenticated — waiting for first sync",
  };
}
