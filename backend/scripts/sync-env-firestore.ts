/**
 * Sync backend/.env with Firestore cortex_config/env
 * Usage (from backend/): npm run sync:env:pull | npm run sync:env:push
 */
import "../src/config/env.js";
import { pullEnvFromFirestore, pushEnvToFirestore } from "../src/features/firebase/env-sync.js";
import { getFirebaseAdminStatus } from "../src/features/firebase/admin.js";

const cmd = process.argv[2]?.toLowerCase();

async function main() {
  const status = getFirebaseAdminStatus();
  if (!status.configured) {
    console.error("Firebase not configured. Set FIREBASE_PROJECT_ID and credentials in .env");
    console.error("See docs/firebase-setup.md");
    process.exit(1);
  }

  if (cmd === "pull") {
    const r = await pullEnvFromFirestore();
    if (!r.ok) {
      console.error("Pull failed:", r.error);
      process.exit(1);
    }
    console.log(`Wrote ${r.keys.length} keys to ${r.path}`);
    return;
  }

  if (cmd === "push") {
    const r = await pushEnvToFirestore();
    if (!r.ok) {
      console.error("Push failed:", r.error);
      process.exit(1);
    }
    console.log(`Pushed ${r.keys.length} keys to Firestore`);
    return;
  }

  console.error("Usage: npm run sync:env:pull | npm run sync:env:push");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
