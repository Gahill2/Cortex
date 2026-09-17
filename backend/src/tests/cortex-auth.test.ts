import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimitBuckets } from "../middleware/rate-limit.js";
import { sessionLockStore } from "../features/auth/session-lock-store.js";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET ??= "test-secret-for-cortex-auth-suite-12345";
  process.env.CORTEX_DEMO_USER_EMAIL ??= "grey@cortex.local";
  process.env.CORTEX_DEMO_USER_PASSWORD ??= "ChangeMe123!";
  process.env.CORTEX_DEMO_USER_PIN ??= "1234";

  ({ app } = await import("../app.js"));
});

beforeEach(() => {
  resetRateLimitBuckets();
  sessionLockStore.clear();
});

describe("cortex auth routes", () => {
  it("logs in with valid demo credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: process.env.CORTEX_DEMO_USER_EMAIL,
      password: process.env.CORTEX_DEMO_USER_PASSWORD
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(process.env.CORTEX_DEMO_USER_EMAIL);
  });

  it("verifies pin with valid bearer token", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: process.env.CORTEX_DEMO_USER_EMAIL,
      password: process.env.CORTEX_DEMO_USER_PASSWORD
    });
    const bearer = `Bearer ${loginResponse.body.token}`;

    const sessionBeforePin = await request(app).get("/api/auth/session").set("authorization", bearer);
    expect(sessionBeforePin.status).toBe(423);

    const protectedBeforePin = await request(app)
      .get("/api/firebase/status")
      .set("authorization", bearer);
    expect(protectedBeforePin.status).toBe(423);

    const verifyPinResponse = await request(app)
      .post("/api/auth/verify-pin")
      .set("authorization", bearer)
      .send({ pin: process.env.CORTEX_DEMO_USER_PIN });

    expect(verifyPinResponse.status).toBe(200);
    expect(verifyPinResponse.body.ok).toBe(true);
    expect(verifyPinResponse.body.user.email).toBe(process.env.CORTEX_DEMO_USER_EMAIL);

    const sessionAfterPin = await request(app).get("/api/auth/session").set("authorization", bearer);
    expect(sessionAfterPin.status).toBe(200);

    const protectedAfterPin = await request(app)
      .get("/api/firebase/status")
      .set("authorization", bearer);
    expect(protectedAfterPin.status).toBe(200);
  });

  it("locks session and blocks session endpoint", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: process.env.CORTEX_DEMO_USER_EMAIL,
      password: process.env.CORTEX_DEMO_USER_PASSWORD
    });

    const lockResponse = await request(app)
      .post("/api/auth/lock")
      .set("authorization", `Bearer ${loginResponse.body.token}`)
      .send({ lockReason: "manual" });

    const sessionResponse = await request(app)
      .get("/api/auth/session")
      .set("authorization", `Bearer ${loginResponse.body.token}`);

    expect(lockResponse.status).toBe(200);
    expect(lockResponse.body.ok).toBe(true);
    expect(sessionResponse.status).toBe(423);
  });

  it("verifies OTP for demo email when Postgres is unavailable", async () => {
    const sendResponse = await request(app)
      .post("/api/auth/send-otp")
      .send({ email: process.env.CORTEX_DEMO_USER_EMAIL });
    expect(sendResponse.status).toBe(200);
    const code = sendResponse.body.devOtpCode as string | undefined;
    if (!code) {
      // SMTP configured in CI — cannot assert code without inbox access
      return;
    }

    const verifyResponse = await request(app).post("/api/auth/verify-otp").send({
      email: process.env.CORTEX_DEMO_USER_EMAIL,
      code
    });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.token).toEqual(expect.any(String));
    expect(verifyResponse.body.user.email).toBe(process.env.CORTEX_DEMO_USER_EMAIL);
  });

  it("does not issue OTP codes for unknown email addresses", async () => {
    const response = await request(app)
      .post("/api/auth/send-otp")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      message: "If that address is recognized, a code has been sent."
    });
  });

  it("returns 429 for route-level login rate limit", async () => {
    const attemptResults: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await request(app).post("/api/auth/login").send({
        email: process.env.CORTEX_DEMO_USER_EMAIL,
        password: "WrongPassword123!"
      });
      attemptResults.push(response.status);
    }

    expect(attemptResults.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(attemptResults[5]).toBe(429);
  });
});
