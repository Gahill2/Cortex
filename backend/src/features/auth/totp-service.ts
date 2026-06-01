import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { settingsRepo } from "../../repositories/index.js";
import { decryptSecret, encryptSecret } from "../../utils/secret-crypto.js";
import { demoUserStore } from "./demo-user-store.js";
import { prisma } from "../../db/prisma.js";

const ISSUER = "Cortex";

interface TotpPrefs {
  totpSecretEnc?: string;
  totpPendingSecretEnc?: string;
  totpEnabled?: boolean;
}

function readTotpPrefs(extraJson: Record<string, unknown> | null | undefined): TotpPrefs {
  const raw = extraJson?.totp;
  if (!raw || typeof raw !== "object") return {};
  const t = raw as TotpPrefs;
  return {
    totpSecretEnc: typeof t.totpSecretEnc === "string" ? t.totpSecretEnc : undefined,
    totpPendingSecretEnc: typeof t.totpPendingSecretEnc === "string" ? t.totpPendingSecretEnc : undefined,
    totpEnabled: t.totpEnabled === true,
  };
}

function mergeTotpPrefs(
  extraJson: Record<string, unknown> | null | undefined,
  totp: TotpPrefs
): Record<string, unknown> {
  return { ...(extraJson ?? {}), totp };
}

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const demo = await demoUserStore.getDemoUser();
  if (normalized === demo.email.toLowerCase()) return demo.id;
  try {
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function getTotpStatusForEmail(email: string): Promise<{ userId: string | null; enabled: boolean }> {
  const userId = await resolveUserIdByEmail(email);
  if (!userId) return { userId: null, enabled: false };
  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  return { userId, enabled: Boolean(prefs.totpEnabled && prefs.totpSecretEnc) };
}

export async function getTotpStatusForUser(userId: string): Promise<{ enabled: boolean }> {
  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  return { enabled: Boolean(prefs.totpEnabled && prefs.totpSecretEnc) };
}

export async function verifyTotpLogin(email: string, code: string): Promise<boolean> {
  const userId = await resolveUserIdByEmail(email);
  if (!userId) return false;
  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  if (!prefs.totpEnabled || !prefs.totpSecretEnc) return false;
  const secret = decryptSecret(prefs.totpSecretEnc);
  if (!secret) return false;
  const result = await verify({ token: code, secret });
  return result.valid;
}

export async function startTotpSetup(userId: string, email: string): Promise<{
  qrDataUrl: string;
  manualKey: string;
  otpauthUrl: string;
}> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });

  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  await settingsRepo.upsert(userId, {
    extraJson: mergeTotpPrefs(settings?.extraJson, {
      ...prefs,
      totpPendingSecretEnc: encryptSecret(secret),
      totpEnabled: false,
    }),
  });

  return { qrDataUrl, manualKey: secret, otpauthUrl };
}

export async function confirmTotpSetup(userId: string, code: string): Promise<boolean> {
  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  if (!prefs.totpPendingSecretEnc) return false;
  const secret = decryptSecret(prefs.totpPendingSecretEnc);
  if (!secret) return false;
  const result = await verify({ token: code, secret });
  if (!result.valid) return false;

  await settingsRepo.upsert(userId, {
    extraJson: mergeTotpPrefs(settings?.extraJson, {
      totpSecretEnc: prefs.totpPendingSecretEnc,
      totpPendingSecretEnc: undefined,
      totpEnabled: true,
    }),
  });
  return true;
}

export async function disableTotp(userId: string, code: string): Promise<boolean> {
  const settings = await settingsRepo.get(userId);
  const prefs = readTotpPrefs(settings?.extraJson);
  if (!prefs.totpEnabled || !prefs.totpSecretEnc) return false;
  const secret = decryptSecret(prefs.totpSecretEnc);
  if (!secret) return false;
  const result = await verify({ token: code, secret });
  if (!result.valid) return false;

  await settingsRepo.upsert(userId, {
    extraJson: mergeTotpPrefs(settings?.extraJson, {
      totpSecretEnc: undefined,
      totpPendingSecretEnc: undefined,
      totpEnabled: false,
    }),
  });
  return true;
}
