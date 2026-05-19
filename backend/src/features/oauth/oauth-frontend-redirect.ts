import { env } from "../../config/env.js";

const defaultFrontend = () => (env.CORTEX_FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

/** Allowed browser origins for post-OAuth redirects (must match where the UI stores the JWT). */
function isAllowedReturnOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (!/^https?:$/.test(url.protocol)) return false;
    const base = `${url.protocol}//${url.host}`;
    const configured = env.CORTEX_FRONTEND_URL?.trim().replace(/\/$/, "");
    if (configured && base === configured) return true;
    const cors = (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
    if (cors.includes(base)) return true;
    if (env.NODE_ENV !== "production") {
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

/** Prefer the UI origin that started OAuth so localhost vs 127.0.0.1 does not split localStorage. */
export function resolveOAuthFrontendBase(returnOrigin?: string): string {
  const trimmed = returnOrigin?.trim();
  if (trimmed && isAllowedReturnOrigin(trimmed)) {
    return new URL(trimmed).origin;
  }
  return defaultFrontend();
}
