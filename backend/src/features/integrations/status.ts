import { env } from "../../config/env.js";
import { getFirebaseAdminStatus } from "../firebase/admin.js";
import { pingFirestore } from "../firebase/env-sync.js";
import { isGmailConfigured } from "../gmail/gmail-service.js";
import { getGoogleCredentials } from "../gmail/google-token-store.js";
import { isN8nConfigured } from "../n8n/n8n-client.js";
import { isNotionConfigured, testNotionConnection } from "../notion/notion-service.js";
import { isSpotifyConfigured } from "../spotify/spotify-service.js";
import { isSpotifyConnected } from "../spotify/spotify-token-store.js";

export type IntegrationStatus = {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  detail?: string;
};

export async function getIntegrationsStatus(userId?: string): Promise<IntegrationStatus[]> {
  const firebaseAdmin = getFirebaseAdminStatus();
  const firestore = firebaseAdmin.configured ? await pingFirestore() : { ok: false };

  let notion: IntegrationStatus = {
    id: "notion",
    name: "Notion",
    configured: isNotionConfigured(),
    connected: false,
    detail: "Add NOTION_PERSONAL_TOKEN or NOTION_INTERNAL_TOKEN"
  };
  if (notion.configured) {
    const test = await testNotionConnection();
    notion = { ...notion, connected: test.ok, detail: test.ok ? test.name : test.error };
  }

  return [
    {
      id: "anthropic",
      name: "AI (Anthropic)",
      configured: Boolean(env.ANTHROPIC_API_KEY),
      connected: Boolean(env.ANTHROPIC_API_KEY)
    },
    {
      id: "firebase",
      name: "Firebase / Firestore",
      configured: firebaseAdmin.configured,
      connected: firestore.ok,
      detail: firebaseAdmin.configured
        ? firestore.ok
          ? "Env sync + online data"
          : "Check Firestore rules / API"
        : "Set FIREBASE_PROJECT_ID + service account"
    },
    {
      id: "n8n",
      name: "n8n automation",
      configured: isN8nConfigured(),
      connected: isN8nConfigured(),
      detail: isN8nConfigured() ? "Webhook configured" : "Set N8N_WEBHOOK_URL"
    },
    notion,
    {
      id: "canva",
      name: "Canva",
      configured: Boolean(env.CANVA_CLIENT_ID || env.CANVA_APP_ID),
      connected: Boolean(env.CANVA_CLIENT_ID || env.CANVA_APP_ID),
      detail: "Design embed — full API coming soon"
    },
    {
      id: "openclaw",
      name: "OpenClaw / MCP",
      configured: Boolean(env.CORTEX_MCP_MODE),
      connected: Boolean(env.CORTEX_MCP_MODE),
      detail: env.CORTEX_MCP_MODE
        ? `${env.CORTEX_MCP_MODE} @ ${env.CORTEX_MCP_HOST}:${env.CORTEX_MCP_PORT}`
        : "Set CORTEX_MCP_* in env"
    },
    await buildGmailStatus(userId),
    await buildSpotifyStatus(userId)
  ];
}

async function buildGmailStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = isGmailConfigured();
  let connected = false;
  if (configured && userId) {
    const creds = await getGoogleCredentials(userId);
    connected = Boolean(creds?.refresh_token || creds?.access_token);
  }
  return {
    id: "gmail",
    name: "Gmail",
    configured,
    connected,
    detail: connected ? "Inbox linked" : configured ? "Connect from Gmail page" : "Set Google OAuth in env"
  };
}

async function buildSpotifyStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = isSpotifyConfigured();
  const connected = configured && userId ? await isSpotifyConnected(userId) : false;
  return {
    id: "spotify",
    name: "Spotify",
    configured,
    connected,
    detail: connected ? "Playback linked" : configured ? "Link account in Settings" : "Set Spotify credentials in backend .env"
  };
}
