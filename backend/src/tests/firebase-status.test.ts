import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimitBuckets } from "../middleware/rate-limit.js";

let app: Express;
let token: string;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET ??= "test-secret-for-cortex-auth-suite-12345";
  process.env.CORTEX_DEMO_USER_EMAIL ??= "grey@cortex.local";
  process.env.CORTEX_DEMO_USER_PASSWORD ??= "Ctx-D3m0!Secure8x";
  process.env.CORTEX_DEMO_USER_PIN ??= "1234";

  ({ app } = await import("../app.js"));

  const login = await request(app).post("/api/auth/login").send({
    email: process.env.CORTEX_DEMO_USER_EMAIL,
    password: process.env.CORTEX_DEMO_USER_PASSWORD
  });
  token = login.body.token;
  await request(app)
    .post("/api/auth/verify-pin")
    .set("Authorization", `Bearer ${token}`)
    .send({ pin: process.env.CORTEX_DEMO_USER_PIN });
});

beforeEach(() => {
  resetRateLimitBuckets();
});

describe("firebase", () => {
  it("GET /api/health includes firebase admin status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.firebase).toMatchObject({
      projectId: expect.anything(),
      credentialSource: expect.stringMatching(/^(json_path|env_vars|application_default|none)$/)
    });
    expect(typeof res.body.firebase.configured).toBe("boolean");
  });

  it("GET /api/firebase/status requires auth", async () => {
    const unauth = await request(app).get("/api/firebase/status");
    expect(unauth.status).toBe(401);

    const res = await request(app)
      .get("/api/firebase/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.firebase.env_doc).toBeTruthy();
  });
});
