import { isGmailConfigured } from "../gmail/gmail-service.js";
import { listMailAccounts } from "../mail/mail-account-store.js";
import { getCloudStorageStatus, type HomelabCloudStorage } from "./homelab-status.js";

export interface HomelabMailIntegration {
  gmailConfigured: boolean;
  connected: boolean;
  accountCount: number;
  message?: string;
}

export interface HomelabIntegrationsSummary {
  cloud: HomelabCloudStorage;
  mail: HomelabMailIntegration;
}

export async function getHomelabIntegrationsSummary(userId: string): Promise<HomelabIntegrationsSummary> {
  let cloud: HomelabCloudStorage;
  let accounts: Awaited<ReturnType<typeof listMailAccounts>>;
  try {
    [cloud, accounts] = await Promise.all([getCloudStorageStatus(), listMailAccounts(userId)]);
  } catch {
    cloud = {
      configured: false,
      connected: false,
      baseUrl: "",
      username: "",
      quota: null,
      message: "Cloud status unavailable",
    };
    accounts = [];
  }

  const gmailConfigured = isGmailConfigured();
  const accountCount = accounts.length;

  let mailMessage: string | undefined;
  if (!gmailConfigured) {
    mailMessage = "Gmail OAuth not configured — set GOOGLE_CLIENT_ID/SECRET in api.env";
  } else if (accountCount === 0) {
    mailMessage = "No mail account linked — open Mail and connect Gmail";
  }

  return {
    cloud,
    mail: {
      gmailConfigured,
      connected: accountCount > 0,
      accountCount,
      message: mailMessage,
    },
  };
}
