import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

type GmailOAuthState = {
  purpose: "gmail_oauth";
  sub: string;
  desktop?: boolean;
  returnOrigin?: string;
};

export const signGmailOAuthState = (
  userId: string,
  opts?: { desktop?: boolean; returnOrigin?: string }
): string =>
  jwt.sign(
    {
      purpose: "gmail_oauth",
      sub: userId,
      ...(opts?.desktop ? { desktop: true } : {}),
      ...(opts?.returnOrigin?.trim() ? { returnOrigin: opts.returnOrigin.trim() } : {})
    } satisfies GmailOAuthState,
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );

export const verifyGmailOAuthState = (
  token: string
): { userId: string; desktop: boolean; returnOrigin?: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<GmailOAuthState>;
    if (decoded.purpose !== "gmail_oauth" || typeof decoded.sub !== "string") {
      throw new HttpError(400, "Invalid OAuth state");
    }
    return {
      userId: decoded.sub,
      desktop: decoded.desktop === true,
      returnOrigin: typeof decoded.returnOrigin === "string" ? decoded.returnOrigin : undefined
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid or expired OAuth state");
  }
};
