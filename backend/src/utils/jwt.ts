import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type TokenPayload = {
  userId: string;
  email: string;
  organizationId?: string;
};

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;
