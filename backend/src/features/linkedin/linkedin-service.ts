import {
  isIntegrationOAuthReady,
  resolveIntegrationOAuth,
  type IntegrationOAuthCredentials,
} from "../integrations/oauth-config.js";
import {
  getLinkedInTokens,
  saveLinkedInTokens,
  type LinkedInTokens,
} from "./linkedin-token-store.js";

const LINKEDIN_AUTH = "https://www.linkedin.com/oauth/v2";
const LINKEDIN_API = "https://api.linkedin.com";

const SCOPES = ["openid", "profile", "email"].join(" ");

export type LinkedInProfile = {
  sub: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  email?: string;
  profileUrl?: string;
};

export async function isLinkedInConfigured(): Promise<boolean> {
  return isIntegrationOAuthReady("linkedin");
}

export async function buildLinkedInAuthUrl(state: string): Promise<string> {
  const oauth = await resolveIntegrationOAuth("linkedin");
  if (!oauth) throw new Error("LinkedIn OAuth not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    state,
    scope: SCOPES,
  });
  return `${LINKEDIN_AUTH}/authorization?${params}`;
}

async function exchangeTokenBody(
  oauth: IntegrationOAuthCredentials,
  body: URLSearchParams
): Promise<LinkedInTokens> {
  const res = await fetch(`${LINKEDIN_AUTH}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokens> {
  const oauth = await resolveIntegrationOAuth("linkedin");
  if (!oauth) throw new Error("LinkedIn OAuth not configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    redirect_uri: oauth.redirectUri,
  });
  return exchangeTokenBody(oauth, body);
}

async function refreshLinkedInTokens(tokens: LinkedInTokens): Promise<LinkedInTokens> {
  if (!tokens.refresh_token) {
    throw new Error("LinkedIn refresh token missing — reconnect your account");
  }
  const oauth = await resolveIntegrationOAuth("linkedin");
  if (!oauth) throw new Error("LinkedIn OAuth not configured");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
  });
  const refreshed = await exchangeTokenBody(oauth, body);
  return {
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
  };
}

export async function getValidLinkedInToken(userId: string): Promise<string> {
  const tokens = await getLinkedInTokens(userId);
  if (!tokens?.access_token) {
    throw new Error("LinkedIn not connected");
  }
  if (tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token;
  }
  const refreshed = await refreshLinkedInTokens(tokens);
  await saveLinkedInTokens(userId, refreshed);
  return refreshed.access_token;
}

export async function fetchLinkedInProfile(userId: string): Promise<LinkedInProfile | null> {
  try {
    const token = await getValidLinkedInToken(userId);
    const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      sub: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email?: string;
    };
    return {
      sub: data.sub,
      name: data.name,
      givenName: data.given_name,
      familyName: data.family_name,
      picture: data.picture,
      email: data.email,
      profileUrl: data.sub ? `https://www.linkedin.com/in/${data.sub}` : undefined,
    };
  } catch {
    return null;
  }
}
