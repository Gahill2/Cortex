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

  sessionLockStore.unlock(token);
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
  if (sessionLockStore.isLocked(token)) {
    throw new HttpError(423, "Session is locked, log in again");
  }

  const demoUser = await demoUserStore.getDemoUser();
  const isValidPin = await bcrypt.compare(pin, demoUser.pinHash);
  if (!isValidPin) {
    throw new HttpError(401, "Invalid PIN");
  }

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session token");
  }
  res.json({
    ok: true,
    user: payload
  });
});

cortexAuthRouter.get("/session", requireAuth, routeRateLimit(30, 60_000), (req, res) => {
  const bearerToken = req.header("authorization")?.replace("Bearer ", "") ?? "";
  if (sessionLockStore.isLocked(bearerToken)) {
    throw new HttpError(423, "Session locked");
  }
  res.json({ authenticated: true, user: req.auth });
});

cortexAuthRouter.post("/lock", requireAuth, routeRateLimit(10, 60_000), (req, res) => {
  const { lockReason } = lockSchema.parse(req.body ?? {});
  const token = req.header("authorization")?.replace("Bearer ", "");
  if (!token) {
    throw new HttpError(401, "Missing bearer token");
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
  // Local dev: no SMTP (or send failure) — surface code in UI so login works without inbox access
  if (env.NODE_ENV === "development" && !emailed) {
    body.devOtpCode = code;
    body.devHint = "Development only: email was not sent. Use the code below; configure SMTP_USER/SMTP_PASS to receive real mail.";
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

  // Issue a JWT for this email — reuse demo user id when emails match,
  // otherwise use email as the userId so each user gets their own identity.
  const demoUser = await demoUserStore.getDemoUser();
  const userId = email.toLowerCase() === demoUser.email.toLowerCase()
    ? demoUser.id
    : email.toLowerCase();

  const token = signAccessToken({ userId, email });
  sessionLockStore.unlock(token);

  res.json({
    token,
    user: { id: userId, email }
  });
});
