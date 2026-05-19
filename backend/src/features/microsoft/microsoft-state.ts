import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

type MicrosoftOAuthState = {
  purpose: "microsoft";
  sub: string;
  desktop?: boolean;
  returnOrigin?: string;
};

export const signMicrosoftState = (
  userId: string,
  opts?: { desktop?: boolean; returnOrigin?: string }
): string =>
  jwt.sign(
    {
      purpose: "microsoft",
      sub: userId,
      ...(opts?.desktop ? { desktop: true } : {}),
      ...(opts?.returnOrigin?.trim() ? { returnOrigin: opts.returnOrigin.trim() } : {})
    } satisfies MicrosoftOAuthState,
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );

export const verifyMicrosoftState = (
  token: string
): { userId: string; desktop: boolean; returnOrigin?: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<MicrosoftOAuthState>;
    if (decoded.purpose !== "microsoft" || typeof decoded.sub !== "string") {
      throw new HttpError(400, "Invalid Microsoft OAuth state");
    }
    return {
      userId: decoded.sub,
      desktop: decoded.desktop === true,
      returnOrigin: typeof decoded.returnOrigin === "string" ? decoded.returnOrigin : undefined
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid or expired Microsoft OAuth state");
  }
};
