import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "../../utils/logger.js";

export type FirebaseAdminStatus = {
  configured: boolean;
  projectId: string | null;
  credentialSource: "json_path" | "env_vars" | "application_default" | "none";
  error?: string;
};

function resolveCredentialPath(): string | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!raw) return null;
  const p = resolve(process.cwd(), raw);
  return existsSync(p) ? p : null;
}

export function getFirebaseAdminStatus(): FirebaseAdminStatus {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || null;
  const credPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || null;
  const jsonPath = resolveCredentialPath();
  const hasEnvCreds =
    Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim()) &&
    Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim());

  if (!projectId) {
    return { configured: false, projectId: null, credentialSource: "none" };
  }

  if (credPathEnv && !jsonPath) {
    return {
      configured: false,
      projectId,
      credentialSource: "none",
      error: `Service account file not found: ${resolve(process.cwd(), credPathEnv)} — download JSON from Firebase Console → Project settings → Service accounts → Generate new private key, save as backend/firebase-service-account.json`
    };
  }

  if (jsonPath) {
    return { configured: true, projectId, credentialSource: "json_path" };
  }
  if (hasEnvCreds) {
    return { configured: true, projectId, credentialSource: "env_vars" };
  }

  if (process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true") {
    return { configured: true, projectId, credentialSource: "application_default" };
  }

  return {
    configured: false,
    projectId,
    credentialSource: "none",
    error:
      "No Firebase credentials — save service account JSON as backend/firebase-service-account.json and set GOOGLE_APPLICATION_CREDENTIALS, or set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY"
  };
}

export function getFirebaseApp(): App | null {
  const status = getFirebaseAdminStatus();
  if (!status.configured || !status.projectId) {
    if (status.error) {
      logger.error("Firebase not configured", { error: status.error });
    }
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  try {
    const jsonPath = resolveCredentialPath();
    if (jsonPath) {
      const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      return initializeApp({
        credential: cert({
          projectId: json.project_id ?? status.projectId,
          clientEmail: json.client_email!,
          privateKey: json.private_key!
        }),
        projectId: status.projectId
      });
    }

    const email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (email && key) {
      return initializeApp({
        credential: cert({ projectId: status.projectId, clientEmail: email, privateKey: key }),
        projectId: status.projectId
      });
    }

    if (status.credentialSource === "application_default") {
      return initializeApp({ projectId: status.projectId });
    }

    return null;
  } catch (err) {
    logger.error("Firebase init failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}
