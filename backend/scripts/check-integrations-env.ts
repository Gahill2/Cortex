import { env } from "../src/config/env.js";
import { isNotionConfigured, testNotionConnection } from "../src/features/notion/notion-service.js";
import { isN8nConfigured } from "../src/features/n8n/n8n-client.js";
import { isSpotifyConfigured } from "../src/features/spotify/spotify-service.js";
import { getFirebaseAdminStatus } from "../src/features/firebase/admin.js";

console.log("SPOTIFY configured:", isSpotifyConfigured());
console.log("NOTION configured:", isNotionConfigured());
console.log("N8N configured:", isN8nConfigured(), env.N8N_WEBHOOK_URL ? "(url set)" : "(empty)");
console.log("FIREBASE configured:", getFirebaseAdminStatus().configured);

const notion = await testNotionConnection();
console.log("NOTION test:", notion.ok ? `ok ${notion.name}` : notion.error?.slice(0, 120));
