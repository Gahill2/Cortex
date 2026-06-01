import { env } from "../../config/env.js";
import { getFirebaseAdminStatus } from "../firebase/admin.js";
import { pingFirestore } from "../firebase/env-sync.js";
import { isGmailConfigured } from "../gmail/gmail-service.js";
import { getGoogleCredentials } from "../gmail/google-token-store.js";
import { prisma } from "../../db/prisma.js";
import { isN8nConfigured } from "../n8n/n8n-client.js";
import { isNotionConfigured, testNotionConnection } from "../notion/notion-service.js";
import { isSpotifyConfigured } from "../spotify/spotify-service.js";
import { isSpotifyConnected } from "../spotify/spotify-token-store.js";
import { isMicrosoftConfigured } from "../microsoft/microsoft-service.js";
import { getAIStatus } from "../ai/ai-provider.js";
import { getCloudStatus, isNextcloudConfigured } from "../nextcloud/nextcloud-service.js";

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
      id: "kimi",
      name: "AI (Kimi)",
      configured: Boolean(env.KIMI_API_KEY?.trim() || env.MOONSHOT_API_KEY?.trim()),
      connected: Boolean(env.KIMI_API_KEY?.trim() || env.MOONSHOT_API_KEY?.trim()),
      detail: "Moonshot / Kimi API for chat and mail AI"
    },
    ...(await buildOllamaStatus()),
    {
      id: "microsoft",
      name: "Outlook (Microsoft)",
      configured: isMicrosoftConfigured(),
      connected: isMicrosoftConfigured(),
      detail: isMicrosoftConfigured()
        ? "OAuth ready — connect from Mail"
        : "Set MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET in api.env"
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
    await buildSpotifyStatus(userId),
    await buildNextcloudStatus()
  ];
}

async function buildOllamaStatus(): Promise<IntegrationStatus[]> {
  const ai = await getAIStatus();
  return [
    {
      id: "ollama",
      name: "AI (Ollama local)",
      configured: true,
      connected: ai.ollama,
      detail: ai.ollama
        ? `Running · ${ai.ollamaModel}`
        : `Not reachable at ${env.OLLAMA_BASE_URL} — run npm run server:ollama:setup`
    }
  ];
}

async function buildGmailStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = isGmailConfigured();
  let connected = false;
  if (configured && userId) {
    const creds = await getGoogleCredentials(userId);
    const mailLinked = await prisma.mailAccount.count({
      where: { userId, provider: { in: ["gmail", "microsoft"] } }
    });
    connected =
      Boolean(creds?.refresh_token || creds?.access_token) || mailLinked > 0;
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

async function buildNextcloudStatus(): Promise<IntegrationStatus> {
  const configured = isNextcloudConfigured();
  if (!configured) {
    return {
      id: "nextcloud",
      name: "Cloud storage",
      configured: false,
      connected: false,
      detail: "Set NEXTCLOUD_URL + credentials in api.env"
    };
  }
  const status = await getCloudStatus();
  const quota = status.quota;
  const detail = status.connected
    ? quota?.usedPercent != null
      ? `${quota.usedHuman} / ${quota.totalHuman} used`
      : "Nextcloud connected"
    : status.message ?? "Unreachable";
  return {
    id: "nextcloud",
    name: "Cloud storage",
    configured: true,
    connected: status.connected,
    detail
  };
}
