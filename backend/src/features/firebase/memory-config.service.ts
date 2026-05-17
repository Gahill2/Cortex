import { Timestamp } from "firebase-admin/firestore";
import { env } from "../../config/env.js";
import { getFirebaseAdminStatus, getFirestoreDb } from "./admin.js";

export type MemoryConfig = {
  agentmemoryUrl: string;
  agentmemoryProject: string;
  vaultPaths: string[];
};

export type MemoryConfigResponse = {
  config: MemoryConfig;
  sync: {
    firebaseConfigured: boolean;
    source: "local" | "firebase";
    updatedAt: string | null;
  };
};

type FirestoreMemoryConfig = {
  agentmemoryUrl?: string;
  agentmemoryProject?: string;
  vaultPaths?: string[];
  updatedAt?: Timestamp | Date | null;
};

const parseVaultPaths = (value: string): string[] =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const uniquePaths = (values: string[]): string[] => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

export function getObsidianVaultPathsFromEnv(): string[] {
  const fromList = parseVaultPaths(env.OBSIDIAN_VAULT_PATHS);
  if (fromList.length > 0) return fromList;
  const single = env.OBSIDIAN_VAULT_PATH?.trim();
  return single ? [single] : [];
}

const getLocalMemoryConfig = (): MemoryConfig => ({
  agentmemoryUrl: env.AGENTMEMORY_URL.trim(),
  agentmemoryProject: env.AGENTMEMORY_PROJECT.trim(),
  vaultPaths: uniquePaths(getObsidianVaultPathsFromEnv())
});

const toIsoTimestamp = (value: Timestamp | Date | null | undefined): string | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return value.toISOString();
};

export function isFirebaseMemorySyncAvailable(): boolean {
  return getFirebaseAdminStatus().configured && Boolean(getFirestoreDb());
}

export const getMemoryConfigForUser = async (userId: string): Promise<MemoryConfigResponse> => {
  const local = getLocalMemoryConfig();
  const db = getFirestoreDb();
  if (!db) {
    return {
      config: local,
      sync: { firebaseConfigured: false, source: "local", updatedAt: null }
    };
  }

  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) {
    return {
      config: local,
      sync: { firebaseConfigured: true, source: "local", updatedAt: null }
    };
  }

  const remote = ((snap.data() as { memory_config?: FirestoreMemoryConfig } | undefined)?.memory_config ??
    {}) as FirestoreMemoryConfig;

  return {
    config: {
      agentmemoryUrl: (remote.agentmemoryUrl ?? "").trim() || local.agentmemoryUrl,
      agentmemoryProject: (remote.agentmemoryProject ?? "").trim() || local.agentmemoryProject,
      vaultPaths: uniquePaths([...local.vaultPaths, ...((remote.vaultPaths ?? []).map((p) => p.trim()))])
    },
    sync: {
      firebaseConfigured: true,
      source: "firebase",
      updatedAt: toIsoTimestamp(remote.updatedAt)
    }
  };
};

export const syncMemoryConfigForUser = async (
  userId: string,
  payload?: Partial<MemoryConfig>
): Promise<MemoryConfigResponse> => {
  const local = getLocalMemoryConfig();
  const nextConfig: MemoryConfig = {
    agentmemoryUrl: (payload?.agentmemoryUrl ?? local.agentmemoryUrl).trim(),
    agentmemoryProject: (payload?.agentmemoryProject ?? local.agentmemoryProject).trim(),
    vaultPaths: uniquePaths(payload?.vaultPaths ?? local.vaultPaths)
  };

  const db = getFirestoreDb();
  if (!db) {
    return {
      config: nextConfig,
      sync: { firebaseConfigured: false, source: "local", updatedAt: null }
    };
  }

  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        memory_config: {
          ...nextConfig,
          updatedAt: Timestamp.now()
        }
      },
      { merge: true }
    );

  return getMemoryConfigForUser(userId);
};
