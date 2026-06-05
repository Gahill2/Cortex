import { env } from "../../config/env.js";
import { buildCodeChallenge, createCanvaPkceSession } from "./canva-pkce-session.js";
import type { CanvaTokens } from "./canva-token-store.js";

const CANVA_AUTHORIZE = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN = "https://api.canva.com/rest/v1/oauth/token";

export function isCanvaAppsSdkEnvPresent(): boolean {
  return env.CANVA_APP_ID.trim().length > 0;
}

export function isCanvaConnectAuthorizeReady(): boolean {
  return (
    env.CANVA_CLIENT_ID.trim().length > 0 &&
    env.CANVA_CLIENT_SECRET.trim().length > 0 &&
    env.CANVA_REDIRECT_URI.trim().length > 0
  );
}

export function buildCanvaAuthorizeUrl(userId: string): { url: string } {
  if (!isCanvaConnectAuthorizeReady()) {
    throw new Error("Canva Connect OAuth is not fully configured on the server.");
  }
  const { state, codeVerifier } = createCanvaPkceSession(userId);
  const codeChallenge = buildCodeChallenge(codeVerifier);
  const scopes = env.CANVA_CONNECT_SCOPES.trim();
  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: scopes,
    response_type: "code",
    client_id: env.CANVA_CLIENT_ID.trim(),
    state,
    redirect_uri: env.CANVA_REDIRECT_URI.trim(),
  });
  return { url: `${CANVA_AUTHORIZE}?${params.toString()}` };
}

export async function exchangeCanvaAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<CanvaTokens> {
  const cid = env.CANVA_CLIENT_ID.trim();
  const secret = env.CANVA_CLIENT_SECRET.trim();
  const redirect = env.CANVA_REDIRECT_URI.trim();
  const basic = Buffer.from(`${cid}:${secret}`, "utf8").toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
    code,
    redirect_uri: redirect,
  });
  const res = await fetch(CANVA_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Canva token exchange failed (${res.status}): ${raw.slice(0, 500)}`);
  }
  const json = JSON.parse(raw) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
  const expires_at = Date.now() + Math.max(0, json.expires_in) * 1000;
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at,
    scope: json.scope,
  };
}
