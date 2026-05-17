import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CortexMcpConfig } from "./mcpConfig.js";
import { createCortexMcpServer } from "./createCortexMcpServer.js";
import {
  isLoopbackHostname,
  isTailscaleCgnatIpv4,
  isTailscaleMagicDns,
} from "./mcpHostGuards.js";

function tailscaleHostHeaderGuard(config: CortexMcpConfig) {
  return (req: Request, res: Response, next: () => void) => {
    const raw = req.headers.host;
    if (!raw) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing Host header" },
        id: null,
      });
      return;
    }
    let hostname: string;
    try {
      hostname = new URL(`http://${raw}`).hostname;
    } catch {
      res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid Host header" },
        id: null,
      });
      return;
    }

    if (isLoopbackHostname(hostname)) {
      next();
      return;
    }
    if (config.allowedHosts.includes(hostname)) {
      next();
      return;
    }
    if (config.allowTailscaleNames && isTailscaleMagicDns(hostname)) {
      next();
      return;
    }
    if (config.allowTailscaleCidr && isTailscaleCgnatIpv4(hostname)) {
      next();
      return;
    }

    res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: `Host not allowed: ${hostname}` },
      id: null,
    });
  };
}

function attachMcpRoutes(app: Express, config: CortexMcpConfig): void {
  const corsOptions =
    config.mode === "tailscale" && !config.strictCors
      ? {
          origin: (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void
          ) => {
            if (!origin) {
              callback(null, true);
              return;
            }
            if (config.corsOrigins.includes(origin)) {
              callback(null, true);
              return;
            }
            try {
              const hostname = new URL(origin).hostname;
              if (config.allowTailscaleNames && isTailscaleMagicDns(hostname)) {
                callback(null, true);
                return;
              }
              if (config.allowTailscaleCidr && isTailscaleCgnatIpv4(hostname)) {
                callback(null, true);
                return;
              }
            } catch {
              callback(new Error("Invalid Origin"));
              return;
            }
            callback(new Error("Not allowed by CORS"));
          },
          methods: ["GET", "POST", "OPTIONS"],
        }
      : {
          origin: (config.corsOrigins.length ? config.corsOrigins : false) as
            | boolean
            | string[]
            | false,
          methods: ["GET", "POST", "OPTIONS"],
        };

  app.use(cors(corsOptions));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "cortex-mcp",
      mode: config.mode,
      port: config.port,
      listenHost: config.listenHost,
      tailscale: {
        cidrAllowed: config.allowTailscaleCidr,
        magicDnsAllowed: config.allowTailscaleNames,
        relaxedCors: config.mode === "tailscale" && !config.strictCors,
      },
      timestamp: new Date().toISOString(),
    });
  });

  const handleMcp = async (req: Request, res: Response) => {
    const server = createCortexMcpServer(config);
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body
      );
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("[cortex-mcp] request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  app.post("/mcp", (req, res) => void handleMcp(req, res));
  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "GET not supported on /mcp — use Streamable HTTP POST client.",
      },
      id: null,
    });
  });
}

export function buildMcpExpressApp(config: CortexMcpConfig): Express {
  if (config.mode === "local") {
    const app = createMcpExpressApp();
    attachMcpRoutes(app, config);
    return app;
  }

  const app = express();
  app.use(express.json());
  app.use(tailscaleHostHeaderGuard(config));
  attachMcpRoutes(app, config);
  return app;
}
