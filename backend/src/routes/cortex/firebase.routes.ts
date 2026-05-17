import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { getFirebaseAdminStatus } from "../../features/firebase/admin.js";
import {
  pingFirestore,
  pullEnvFromFirestore,
  pushEnvToFirestore,
  getEnvDocPath
} from "../../features/firebase/env-sync.js";
import { HttpError } from "../../utils/http-error.js";

export const cortexFirebaseRouter = Router();

cortexFirebaseRouter.get("/status", requireAuth, routeRateLimit(30, 60_000), async (_req, res) => {
  const admin = getFirebaseAdminStatus();
  const firestore = admin.configured ? await pingFirestore() : { ok: false, error: "not configured" };
  res.json({
    ok: true,
    firebase: {
      ...admin,
      env_doc: getEnvDocPath(),
      firestore_reachable: firestore.ok,
      firestore_error: firestore.error ?? null
    }
  });
});

cortexFirebaseRouter.post("/env/pull", requireAuth, routeRateLimit(3, 60_000), async (_req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FIREBASE_ENV_SYNC !== "true") {
    throw new HttpError(403, "Env sync disabled in production");
  }
  const result = await pullEnvFromFirestore();
  if (!result.ok) {
    throw new HttpError(503, result.error ?? "Pull failed");
  }
  res.json({ ok: true, keys: result.keys, path: result.path });
});

cortexFirebaseRouter.post("/env/push", requireAuth, routeRateLimit(3, 60_000), async (_req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FIREBASE_ENV_SYNC !== "true") {
    throw new HttpError(403, "Env sync disabled in production");
  }
  const result = await pushEnvToFirestore();
  if (!result.ok) {
    throw new HttpError(503, result.error ?? "Push failed");
  }
  res.json({ ok: true, keys: result.keys, doc: getEnvDocPath() });
});
