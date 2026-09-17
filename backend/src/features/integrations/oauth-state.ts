import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

/**
 * Shared signer/verifier for short-lived OAuth `state` JWTs. Each integration
 * builds one keyed by a unique `purpose` claim instead of duplicating the same
 * sign/verify boilerplate.
 */
export interface OAuthStateSignOptions {
  desktop?: boolean;
  returnOrigin?: string;
}

export interface OAuthStatePayload {
  userId: string;
  desktop: boolean;
  returnOrigin?: string;
}

export interface OAuthStateMessages {
  /** Message thrown when the token is structurally invalid (wrong purpose/subject). */
  invalid?: string;
  /** Message thrown when the token fails verification (bad signature/expired). */
  expired?: string;
}

export interface OAuthState {
  sign: (userId: string, options?: OAuthStateSignOptions) => string;
  verify: (token: string) => OAuthStatePayload;
}

export const createOAuthState = (purpose: string, messages: OAuthStateMessages = {}): OAuthState => {
  const invalidMessage = messages.invalid ?? "Invalid OAuth state";
  const expiredMessage = messages.expired ?? "Invalid or expired OAuth state";

  const sign = (userId: string, options?: OAuthStateSignOptions): string =>
    jwt.sign(
      {
        purpose,
        sub: userId,
        ...(options?.desktop ? { desktop: true } : {}),
        ...(options?.returnOrigin?.trim() ? { returnOrigin: options.returnOrigin.trim() } : {}),
      },
      env.JWT_SECRET,
      { expiresIn: "10m" }
    );

  const verify = (token: string): OAuthStatePayload => {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        purpose?: string;
        sub?: string;
        desktop?: boolean;
        returnOrigin?: string;
      };
      if (decoded.purpose !== purpose || typeof decoded.sub !== "string") {
        throw new HttpError(400, invalidMessage);
      }
      return {
        userId: decoded.sub,
        desktop: decoded.desktop === true,
        returnOrigin: typeof decoded.returnOrigin === "string" ? decoded.returnOrigin : undefined,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, expiredMessage);
    }
  };

  return { sign, verify };
};
