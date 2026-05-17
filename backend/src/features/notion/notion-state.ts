import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

type NotionOAuthState = {
  purpose: "notion_oauth";
  sub: string;
};

export const signNotionOAuthState = (userId: string): string =>
  jwt.sign({ purpose: "notion_oauth", sub: userId } satisfies NotionOAuthState, env.JWT_SECRET, {
    expiresIn: "10m",
  });

export const verifyNotionOAuthState = (token: string): { userId: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<NotionOAuthState>;
    if (decoded.purpose !== "notion_oauth" || typeof decoded.sub !== "string") {
      throw new HttpError(400, "Invalid OAuth state");
    }
    return { userId: decoded.sub };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid or expired OAuth state");
  }
};
