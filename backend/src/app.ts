import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { cortexRouter } from "./routes/cortex/index.js";
import { cortexBillingWebhookRouter } from "./routes/cortex/billing.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

/** Pi-hole / homelab friendly names (e.g. http://cortex.cortex:8080 when HOMELAB_DNS_DOMAIN=cortex). */
function homelabBrowserOrigins(): string[] {
  const domain = env.HOMELAB_DNS_DOMAIN.trim().replace(/^\./, "");
  if (!domain) return [];
  const webPort = "8080";
  const host = `cortex.${domain}`;
  const origins = [
    `http://${host}:${webPort}`,
    `https://${host}:${webPort}`,
    `http://${host}`,
    `https://${host}`,
  ];
  return origins;
}

function buildCorsOrigins(): string[] {
  const fromEnv = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : env.NODE_ENV === "production"
      ? []
      : [...defaultOrigins];
  const frontend = env.CORTEX_FRONTEND_URL?.trim();
  if (frontend && !fromEnv.includes(frontend)) {
    fromEnv.push(frontend);
  }
  for (const origin of homelabBrowserOrigins()) {
    if (!fromEnv.includes(origin)) fromEnv.push(origin);
  }
  if (env.NODE_ENV === "production" && fromEnv.length === 0) {
    console.warn(
      "[cortex] CORS_ORIGINS and CORTEX_FRONTEND_URL are unset — API will boot for healthchecks; configure before browser traffic (see backend/.env.railway.example)"
    );
  }
  return fromEnv.length > 0 ? fromEnv : defaultOrigins;
}

const corsOrigins = buildCorsOrigins();

export const app = express();
// CSRF: API uses Bearer JWT in Authorization (not cookies). Browsers do not attach
// Authorization on cross-site requests by default, so classic CSRF does not apply.
// If cookie-based auth is added later, enable CSRF middleware on state-changing routes.
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      // Vite may use 5174+ when 5173 is taken; allow localhost dev ports
      if (
        env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      console.warn(`[cortex] CORS blocked: ${origin} (add to CORS_ORIGINS or set HOMELAB_DNS_DOMAIN)`);
      callback(null, false);
    },
    credentials: true
  })
);
app.use(morgan("dev"));

app.use(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  cortexBillingWebhookRouter
);

app.use(express.json({ limit: "12mb" }));

app.use("/api", cortexRouter);
app.use(notFoundHandler);
app.use(errorHandler);
