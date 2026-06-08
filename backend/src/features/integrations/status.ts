import { env } from "../../config/env.js";
import { getFirebaseAdminStatus } from "../firebase/admin.js";
import { pingFirestore } from "../firebase/env-sync.js";
import { isGmailConfiguredAsync } from "../gmail/gmail-service.js";
import { getGoogleCredentials } from "../gmail/google-token-store.js";
import { hasGoogleCalendarScope } from "../calendar/google-calendar-client.js";
import { prisma } from "../../db/prisma.js";
import { isN8nConfigured } from "../n8n/n8n-client.js";
import { isNotionConfigured, testNotionConnection } from "../notion/notion-service.js";
import { isSpotifyConfiguredAsync } from "../spotify/spotify-service.js";
import { isSpotifyConnected } from "../spotify/spotify-token-store.js";
import { isLinkedInConfigured, fetchLinkedInProfile } from "../linkedin/linkedin-service.js";
import { isLinkedInConnected } from "../linkedin/linkedin-token-store.js";
import { isMicrosoftConfiguredAsync } from "../microsoft/microsoft-service.js";
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
    await buildMicrosoftStatus(userId),
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
    await buildLinkedInStatus(userId),
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
  const configured = await isGmailConfiguredAsync();
  let connected = false;
  let detail = configured ? "Connect for Gmail inbox + Google Calendar" : "Enable in Settings → paste OAuth keys once";

  if (configured && userId) {
    const gmailCount = await prisma.mailAccount.count({
      where: { userId, provider: "gmail" },
    });
    const creds = await getGoogleCredentials(userId);
    connected = gmailCount > 0 || Boolean(creds?.refresh_token || creds?.access_token);

    if (connected) {
      const accounts = await prisma.mailAccount.findMany({
        where: { userId, provider: "gmail" },
        select: { email: true, isPrimary: true, tokens: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      const primary = accounts.find((a) => a.isPrimary) ?? accounts[0];
      const primaryCreds = primary?.tokens
        ? (JSON.parse(primary.tokens) as { scope?: string })
        : creds;
      const hasCalendar = primaryCreds ? hasGoogleCalendarScope(primaryCreds) : false;
      const accountLabel =
        gmailCount === 1 && primary
          ? primary.email
          : gmailCount > 1
            ? `${gmailCount} Gmail accounts`
            : "Google linked";
      detail = hasCalendar
        ? `${accountLabel} · mail + calendar`
        : `${accountLabel} · reconnect to enable calendar`;
    }
  }

  return {
    id: "google",
    name: "Google (Gmail & Calendar)",
    configured,
    connected,
    detail,
  };
}

async function buildMicrosoftStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = await isMicrosoftConfiguredAsync();
  let connected = false;
  let detail = configured
    ? "Connect for Outlook mail + calendar"
    : "Enable in Settings → paste OAuth keys once";

  if (configured && userId) {
    const msCount = await prisma.mailAccount.count({
      where: { userId, provider: "microsoft" },
    });
    connected = msCount > 0;
    if (connected) {
      const accounts = await prisma.mailAccount.findMany({
        where: { userId, provider: "microsoft" },
        select: { email: true },
        take: 2,
      });
      detail =
        msCount === 1
          ? `${accounts[0]?.email ?? "Outlook"} · mail + calendar`
          : `${msCount} Outlook accounts · mail + calendar`;
    }
  }

  return {
    id: "microsoft",
    name: "Microsoft (Outlook & Calendar)",
    configured,
    connected,
    detail,
  };
}

async function buildSpotifyStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = await isSpotifyConfiguredAsync();
  const connected = configured && userId ? await isSpotifyConnected(userId) : false;
  return {
    id: "spotify",
    name: "Spotify",
    configured,
    connected,
    detail: connected ? "Playback linked" : configured ? "Link account in Settings" : "Set Spotify credentials in backend .env"
  };
}

async function buildLinkedInStatus(userId?: string): Promise<IntegrationStatus> {
  const configured = await isLinkedInConfigured();
  const connected = configured && userId ? await isLinkedInConnected(userId) : false;
  let detail = connected ? "Professional profile linked" : configured ? "Connect in Settings" : "Enable in Settings → paste OAuth keys once";
  if (connected && userId) {
    const profile = await fetchLinkedInProfile(userId);
    if (profile?.name) {
      detail = profile.email ? `${profile.name} · ${profile.email}` : profile.name;
    }
  }
  return {
    id: "linkedin",
    name: "LinkedIn",
    configured,
    connected,
    detail,
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
