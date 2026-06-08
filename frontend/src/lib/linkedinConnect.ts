import { api } from "../api/client";
import { startOAuthFlow } from "./oauth";

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean };
};

const isElectron = () => !!(window as ElectronWindow).electron?.isElectron;

export type LinkedInProfile = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

export type LinkedInStatus = {
  configured: boolean;
  connected: boolean;
  profile?: LinkedInProfile | null;
  redirectUri?: string | null;
};

export async function fetchLinkedInStatus(): Promise<LinkedInStatus | null> {
  try {
    const r = await api.get<{ data?: LinkedInStatus }>("/linkedin/status");
    return r.data?.data ?? null;
  } catch {
    return null;
  }
}

export async function connectLinkedIn(): Promise<void> {
  const r = await api.get<{ data?: { url: string } }>("/linkedin/oauth/url");
  const url = r.data?.data?.url;
  if (!url) {
    throw new Error("No authorization URL returned.");
  }
  startOAuthFlow(url);
}

export async function disconnectLinkedIn(): Promise<void> {
  await api.post("/linkedin/disconnect");
}

/** For Electron deep-link handler */
export async function exchangeLinkedInCode(code: string, state: string): Promise<void> {
  await api.post("/linkedin/oauth/exchange", { code, state });
}

export { isElectron };
