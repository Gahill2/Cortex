import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { signAccessToken, verifyAccessToken } from "../../utils/jwt.js";
import { HttpError } from "../../utils/http-error.js";
import { routeRateLimit } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { demoUserStore } from "../../features/auth/demo-user-store.js";
import { sessionLockStore } from "../../features/auth/session-lock-store.js";
import { otpStore } from "../../features/auth/otp-store.js";
import { sendOtpEmail } from "../../features/auth/email-service.js";
import { demoAuthEnabled, env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/)
});

const tokenSchema = z.object({
  token: z.string().min(1)
});

const lockSchema = z.object({
  lockReason: z.enum(["manual", "idle"]).optional().default("manual")
});

const sendOtpSchema = z.object({
  email: z.email()
});

const verifyOtpSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits")
});

export const cortexAuthRouter = Router();

function isDatabaseUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  return name === "PrismaClientInitializationError" || code === "P1001" || code === "P1017";
}

/** Match imported Railway users (cuid id) and demo user; new OTP users keep email as id until first DB write. */
async function resolveOtpUserId(email: string): Promise<{ userId: string; email: string }> {
  const normalized = email.trim().toLowerCase();
  const demoUser = await demoUserStore.getDemoUser();
  if (normalized === demoUser.email.toLowerCase()) {
    return { userId: demoUser.id, email: demoUser.email };
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return { userId: existing.id, email: existing.email };
    }
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }
  return { userId: normalized, email: normalized };
}

cortexAuthRouter.post("/login", routeRateLimit(5, 60_000), async (req, res) => {
  if (!demoAuthEnabled) {
    throw new HttpError(403, "Password login is disabled in production. Use email OTP.");
  }
  const input = loginSchema.parse(req.body);
  const demoUser = await demoUserStore.getDemoUser();
  const validEmail = input.email.toLowerCase() === demoUser.email.toLowerCase();
  const validPassword = await bcrypt.compare(input.password, demoUser.passwordHash);
  if (!validEmail || !validPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  const token = signAccessToken({
    userId: demoUser.id,
    email: demoUser.email
  });

  sessionLockStore.lock(token);
  res.json({
    token,
    user: {
      id: demoUser.id,
      email: demoUser.email
    }
  });
});

cortexAuthRouter.post("/verify-pin", routeRateLimit(10, 60_000), async (req, res) => {
  if (!demoAuthEnabled) {
    throw new HttpError(403, "PIN verification is disabled in production.");
  }
  const { pin } = verifyPinSchema.parse(req.body);
  const authHeader = req.header("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  const bearerToken = authHeader.slice(7).trim();
  const token = tokenSchema.parse({ token: bearerToken }).token;

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session token");
  }

  const demoUser = await demoUserStore.getDemoUser();
  const isValidPin = await bcrypt.compare(pin, demoUser.pinHash);
  if (!isValidPin) {
    throw new HttpError(401, "Invalid PIN");
  }

  sessionLockStore.unlock(token);
  res.json({
    ok: true,
    user: payload
  });
});

cortexAuthRouter.get("/session", requireAuth, routeRateLimit(30, 60_000), (req, res) => {
  const bearerToken = req.header("authorization")?.replace("Bearer ", "") ?? "";
  if (sessionLockStore.isLocked(bearerToken)) {
    if (demoAuthEnabled) {
      throw new HttpError(423, "Session locked");
    }
    sessionLockStore.unlock(bearerToken);
  }
  res.json({ authenticated: true, user: req.auth, pinUnlock: demoAuthEnabled });
});

cortexAuthRouter.post("/lock", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  const { lockReason } = lockSchema.parse(req.body ?? {});
  const token = req.header("authorization")?.replace("Bearer ", "");
  if (!token) {
    throw new HttpError(401, "Missing bearer token");
  }
  if (!demoAuthEnabled) {
    res.json({ ok: true, lockReason, skipped: true });
    return;
  }
  sessionLockStore.lock(token);
  res.json({ ok: true, lockReason });
});

cortexAuthRouter.post("/logout", requireAuth, routeRateLimit(5, 60_000), (req, res) => {
  const token = req.header("authorization")?.replace("Bearer ", "");
  if (token) {
    sessionLockStore.lock(token);
  }
  res.json({ ok: true });
});

// ── Desktop (Electron) auto-login ────────────────────────────────────────────
// Only works when called from localhost — safe for local-only desktop app.
cortexAuthRouter.get("/desktop-token", routeRateLimit(10, 60_000), (req, res) => {
  const host = req.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new HttpError(403, "Desktop token only available from localhost");
  }
  const secret = env.CORTEX_DESKTOP_SECRET?.trim();
  if (secret) {
    const provided = req.header("x-cortex-desktop-secret");
    if (provided !== secret) {
      throw new HttpError(403, "Invalid desktop client secret");
    }
  } else if (env.NODE_ENV === "production") {
    throw new HttpError(503, "Set CORTEX_DESKTOP_SECRET for desktop login");
  }
  const token = signAccessToken({ userId: "local-user", email: "local@cortex.app" });
  if (demoAuthEnabled) {
    sessionLockStore.lock(token);
  }
  res.json({ token, user: { id: "local-user", email: "local@cortex.app" } });
});

// ── OTP flow ─────────────────────────────────────────────────────────────────

/**
 * POST /cortex/auth/send-otp
 * Generate a 6-digit OTP and email it to the given address.
 * Rate-limited to 3 requests per minute per IP.
 */
const OTP_SEND_LIMIT = env.NODE_ENV === "development" ? 30 : 3;

cortexAuthRouter.post("/send-otp", routeRateLimit(OTP_SEND_LIMIT, 60_000), async (req, res) => {
  const { email } = sendOtpSchema.parse(req.body);
  const code = await otpStore.create(email);
  const emailed = await sendOtpEmail(email, code);
  const body: {
    ok: true;
    message: string;
    devOtpCode?: string;
    devHint?: string;
  } = {
    ok: true,
    message: emailed
      ? "If that address is recognized, a code has been sent."
      : "Verification code could not be emailed (check server logs)."
  };
  // Dev / homelab without SMTP — surface code in UI so login works without inbox access
  const otpFallback = env.NODE_ENV === "development" || env.CORTEX_OTP_DEV_FALLBACK;
  if (otpFallback && !emailed) {
    body.devOtpCode = code;
    body.devHint =
      env.CORTEX_OTP_DEV_FALLBACK && env.NODE_ENV === "production"
        ? "Homelab: email not sent. Use the code below, or set SMTP_USER/SMTP_PASS in deploy/homelab/env/api.env."
        : "Development only: email was not sent. Use the code below; configure SMTP_USER/SMTP_PASS to receive real mail.";
  }
  res.json(body);
});

/**
 * POST /cortex/auth/verify-otp
 * Verify the OTP and issue a JWT. The client then calls /verify-pin to unlock.
 */
cortexAuthRouter.post("/verify-otp", routeRateLimit(10, 60_000), async (req, res) => {
  const { email, code } = verifyOtpSchema.parse(req.body);
  const valid = await otpStore.verify(email, code);
  if (!valid) {
    throw new HttpError(401, "Invalid or expired verification code");
  }

  const { userId, email: resolvedEmail } = await resolveOtpUserId(email);

  const token = signAccessToken({ userId, email: resolvedEmail });
  // Production OTP has no PIN gate — only lock when demo PIN unlock is enabled.
  if (demoAuthEnabled) {
    sessionLockStore.lock(token);
  }

  res.json({
    token,
    user: { id: userId, email: resolvedEmail }
  });
});
