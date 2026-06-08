import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { decryptSecret, encryptSecret } from "../../utils/secret-crypto.js";
import { resolveOAuthFrontendBase } from "../oauth/oauth-frontend-redirect.js";

export type IntegrationOAuthProvider =
  | "google"
  | "microsoft"
  | "spotify"
  | "linkedin"
  | "notion";

export type IntegrationOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  source: "database" | "env";
};

export type IntegrationOAuthSetupItem = {
  id: IntegrationOAuthProvider;
  name: string;
  ready: boolean;
  source: "database" | "env" | "none";
  redirectUri: string;
  consoleUrl: string;
  consoleHint: string;
  scopesHint?: string;
};

type ProviderMeta = {
  id: IntegrationOAuthProvider;
  name: string;
  callbackPath: string;
  consoleUrl: string;
  consoleHint: string;
  scopesHint?: string;
  envClientId: string;
  envClientSecret: string;
  envRedirect?: string;
};

export const INTEGRATION_OAUTH_CATALOG: ProviderMeta[] = [
  {
    id: "google",
    name: "Google (Gmail & Calendar)",
    callbackPath: "/api/gmail/oauth/callback",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleHint: "Create OAuth client ID → Web application. Enable Gmail + Calendar APIs.",
    scopesHint: "Gmail and Calendar scopes are requested when you connect.",
    envClientId: "GOOGLE_CLIENT_ID",
    envClientSecret: "GOOGLE_CLIENT_SECRET",
    envRedirect: "GOOGLE_REDIRECT_URI",
  },
  {
    id: "microsoft",
    name: "Microsoft (Outlook & Calendar)",
    callbackPath: "/api/microsoft/oauth/callback",
    consoleUrl: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    consoleHint: "App registrations → New registration → Web redirect URI (copy below).",
    envClientId: "MICROSOFT_CLIENT_ID",
    envClientSecret: "MICROSOFT_CLIENT_SECRET",
    envRedirect: "MICROSOFT_REDIRECT_URI",
  },
  {
    id: "spotify",
    name: "Spotify",
    callbackPath: "/api/spotify/oauth/callback",
    consoleUrl: "https://developer.spotify.com/dashboard",
    consoleHint: "Create app → Settings → add Redirect URI (copy below).",
    envClientId: "SPOTIFY_CLIENT_ID",
    envClientSecret: "SPOTIFY_CLIENT_SECRET",
    envRedirect: "SPOTIFY_REDIRECT_URI",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    callbackPath: "/api/linkedin/oauth/callback",
    consoleUrl: "https://www.linkedin.com/developers/apps",
    consoleHint: "Create app → Auth → add Redirect URL. Enable Sign In with LinkedIn (OpenID Connect).",
    envClientId: "LINKEDIN_CLIENT_ID",
    envClientSecret: "LINKEDIN_CLIENT_SECRET",
    envRedirect: "LINKEDIN_REDIRECT_URI",
  },
  {
    id: "notion",
    name: "Notion",
    callbackPath: "/api/notion/oauth/callback",
    consoleUrl: "https://www.notion.so/my-integrations",
    consoleHint: "New integration → OAuth → paste Redirect URI. Or use NOTION_INTERNAL_TOKEN instead.",
    envClientId: "NOTION_CLIENT_ID",
    envClientSecret: "NOTION_CLIENT_SECRET",
    envRedirect: "NOTION_REDIRECT_URI",
  },
];

const metaById = new Map(INTEGRATION_OAUTH_CATALOG.map((m) => [m.id, m]));

let dbCache: Map<string, { clientId: string; clientSecret: string }> | null = null;
let dbCacheAt = 0;
const CACHE_MS = 30_000;

export function invalidateIntegrationOAuthCache(): void {
  dbCache = null;
  dbCacheAt = 0;
}

async function ensureDbCache(): Promise<void> {
  if (dbCache && Date.now() - dbCacheAt < CACHE_MS) return;
  const rows = await prisma.integrationOAuthApp.findMany();
  dbCache = new Map(
    rows.map((r) => {
      const secret = decryptSecret(r.clientSecretEnc);
      return [
        r.provider,
        secret ? { clientId: r.clientId, clientSecret: secret } : { clientId: "", clientSecret: "" },
      ];
    })
  );
  dbCacheAt = Date.now();
}

function envOAuthValue(key: string): string {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function readEnvOAuth(meta: ProviderMeta): { clientId: string; clientSecret: string } | null {
  const clientId = envOAuthValue(meta.envClientId);
  const clientSecret = envOAuthValue(meta.envClientSecret);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Public API base for OAuth callbacks (nginx :8080 or direct :4000). */
export function resolveIntegrationRedirectUri(
  provider: IntegrationOAuthProvider,
  returnOrigin?: string
): string {
  const meta = metaById.get(provider);
  if (!meta) throw new Error(`Unknown OAuth provider: ${provider}`);

  if (meta.envRedirect) {
    const explicit = envOAuthValue(meta.envRedirect);
    if (explicit) return explicit;
  }

  const base = resolveOAuthFrontendBase(returnOrigin).replace(/\/$/, "");
  return `${base}${meta.callbackPath}`;
}

export async function resolveIntegrationOAuth(
  provider: IntegrationOAuthProvider,
  returnOrigin?: string
): Promise<IntegrationOAuthCredentials | null> {
  const meta = metaById.get(provider);
  if (!meta) return null;

  await ensureDbCache();
  const fromDb = dbCache?.get(provider);
  const fromEnv = readEnvOAuth(meta);
  const clientId = fromDb?.clientId?.trim() || fromEnv?.clientId;
  const clientSecret = fromDb?.clientSecret?.trim() || fromEnv?.clientSecret;
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: resolveIntegrationRedirectUri(provider, returnOrigin),
    source: fromDb?.clientId && fromDb?.clientSecret ? "database" : "env",
  };
}

export async function isIntegrationOAuthReady(provider: IntegrationOAuthProvider): Promise<boolean> {
  return (await resolveIntegrationOAuth(provider)) !== null;
}

export function hasEnvIntegrationOAuth(provider: IntegrationOAuthProvider): boolean {
  const meta = metaById.get(provider);
  if (!meta) return false;
  return readEnvOAuth(meta) !== null;
}

export async function saveIntegrationOAuth(
  provider: IntegrationOAuthProvider,
  clientId: string,
  clientSecret: string
): Promise<void> {
  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) throw new Error("Client ID and secret are required");

  await prisma.integrationOAuthApp.upsert({
    where: { provider },
    create: {
      provider,
      clientId: id,
      clientSecretEnc: encryptSecret(secret),
    },
    update: {
      clientId: id,
      clientSecretEnc: encryptSecret(secret),
    },
  });
  invalidateIntegrationOAuthCache();
}

export async function deleteIntegrationOAuth(provider: IntegrationOAuthProvider): Promise<void> {
  await prisma.integrationOAuthApp.deleteMany({ where: { provider } });
  invalidateIntegrationOAuthCache();
}

export async function getIntegrationOAuthSetup(
  returnOrigin?: string
): Promise<IntegrationOAuthSetupItem[]> {
  const items: IntegrationOAuthSetupItem[] = [];
  for (const meta of INTEGRATION_OAUTH_CATALOG) {
    const creds = await resolveIntegrationOAuth(meta.id, returnOrigin);
    const envOnly = hasEnvIntegrationOAuth(meta.id);
    await ensureDbCache();
    const hasDb = Boolean(dbCache?.get(meta.id)?.clientId);
    items.push({
      id: meta.id,
      name: meta.name,
      ready: creds !== null,
      source: creds?.source ?? (envOnly ? "env" : hasDb ? "database" : "none"),
      redirectUri: resolveIntegrationRedirectUri(meta.id, returnOrigin),
      consoleUrl: meta.consoleUrl,
      consoleHint: meta.consoleHint,
      scopesHint: meta.scopesHint,
    });
  }
  return items;
}

export function getProviderMeta(provider: IntegrationOAuthProvider): ProviderMeta | undefined {
  return metaById.get(provider);
}
