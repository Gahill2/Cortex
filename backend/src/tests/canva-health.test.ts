import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimitBuckets } from "../middleware/rate-limit.js";

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
});

describe("canva public health", () => {
  it("GET /api/canva/health-env returns booleans only", async () => {
    const res = await request(app).get("/api/canva/health-env");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({
      canva_apps_sdk_env: expect.any(Boolean),
      canva_connect_oauth_ready: expect.any(Boolean),
    });
  });

  it("GET /api/health includes canva_configured flags", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.canva_configured).toEqual({
      apps_sdk_app_id: expect.any(Boolean),
      connect_client_id: expect.any(Boolean),
      connect_client_secret: expect.any(Boolean),
      connect_redirect_uri: expect.any(Boolean),
    });
  });
});
