import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getFirestoreDb, getFirebaseAdminStatus } from "./admin.js";

const DEFAULT_ENV_DOC = "cortex_config/env";

export function getEnvDocPath(): string {
  return process.env.FIRESTORE_ENV_DOC?.trim() || DEFAULT_ENV_DOC;
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function serializeEnvFile(vars: Record<string, string>): string {
  const lines = [
    "# Synced from Firestore — do not commit secrets if this file is gitignored",
    `# doc: ${getEnvDocPath()}`,
    `# updated: ${new Date().toISOString()}`,
    ""
  ];
  for (const [k, v] of Object.entries(vars).sort(([a], [b]) => a.localeCompare(b))) {
    const needsQuotes = /[\s#"'\\]/.test(v);
    lines.push(needsQuotes ? `${k}="${v.replace(/"/g, '\\"')}"` : `${k}=${v}`);
  }
  lines.push("");
  return lines.join("\n");
}

function resolveBackendEnvPath(): string {
  return resolve(process.cwd(), ".env");
}

export async function pullEnvFromFirestore(targetPath?: string): Promise<{
  ok: boolean;
  keys: string[];
  path: string;
  error?: string;
}> {
  const status = getFirebaseAdminStatus();
  if (!status.configured) {
    return { ok: false, keys: [], path: "", error: "Firebase not configured" };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, keys: [], path: "", error: "Firestore unavailable" };
  }

  const [collectionId, docId] = getEnvDocPath().includes("/")
    ? getEnvDocPath().split("/", 2)
    : ["cortex_config", "env"];

  const snap = await db.collection(collectionId).doc(docId).get();
  if (!snap.exists) {
    return { ok: false, keys: [], path: "", error: `Document ${getEnvDocPath()} not found` };
  }

  const data = snap.data() as Record<string, unknown>;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("_")) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      vars[k] = String(v);
    }
  }

  const outPath = targetPath ?? resolveBackendEnvPath();
  writeFileSync(outPath, serializeEnvFile(vars), "utf8");
  return { ok: true, keys: Object.keys(vars), path: outPath };
}

export async function pushEnvToFirestore(sourcePath?: string): Promise<{
  ok: boolean;
  keys: string[];
  error?: string;
}> {
  const status = getFirebaseAdminStatus();
  if (!status.configured) {
    return { ok: false, keys: [], error: "Firebase not configured" };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, keys: [], error: "Firestore unavailable" };
  }

  const envPath = sourcePath ?? resolveBackendEnvPath();
  if (!existsSync(envPath)) {
    return { ok: false, keys: [], error: `Missing ${envPath}` };
  }

  const vars = parseEnvFile(readFileSync(envPath, "utf8"));
  const [collectionId, docId] = getEnvDocPath().includes("/")
    ? getEnvDocPath().split("/", 2)
    : ["cortex_config", "env"];

  await db.collection(collectionId).doc(docId).set(
    { ...vars, _updatedAt: new Date().toISOString() },
    { merge: true }
  );

  return { ok: true, keys: Object.keys(vars) };
}

export async function pingFirestore(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = getFirestoreDb();
    if (!db) return { ok: false, error: "Firestore not initialized" };
    const [collectionId, docId] = getEnvDocPath().includes("/")
      ? getEnvDocPath().split("/", 2)
      : ["cortex_config", "env"];
    await db.collection(collectionId).doc(docId).get();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
