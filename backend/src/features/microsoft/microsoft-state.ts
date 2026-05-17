import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

type MicrosoftOAuthState = { purpose: "microsoft"; sub: string; desktop?: boolean };

export const signMicrosoftState = (userId: string, desktop = false): string =>
  jwt.sign(
    { purpose: "microsoft", sub: userId, ...(desktop ? { desktop: true } : {}) } satisfies MicrosoftOAuthState,
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );

export const verifyMicrosoftState = (token: string): { userId: string; desktop: boolean } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<MicrosoftOAuthState>;
    if (decoded.purpose !== "microsoft" || typeof decoded.sub !== "string") {
      throw new HttpError(400, "Invalid Microsoft OAuth state");
    }
    return { userId: decoded.sub, desktop: decoded.desktop === true };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid or expired Microsoft OAuth state");
  }
};
