import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../utils/jwt.js";

describe("jwt utils", () => {
  it("signs and verifies token payload", () => {
    const token = signAccessToken({
      userId: "u1",
      email: "user@example.com",
      organizationId: "org1"
    });

    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe("u1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.organizationId).toBe("org1");
  });
});
