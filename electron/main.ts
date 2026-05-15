import { app, BrowserWindow, shell, ipcMain, clipboard } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

/** Dev-only: suppress Electron CSP / security noise while Vite uses `unsafe-eval` for HMR. */
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let backendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let memoryProcess: ChildProcess | null = null;
let memoryOnline = false;
let cachedEnv: Record<string, string> = {};

const AGENTMEMORY_VIEWER_URL = process.env.CORTEX_AGENTMEMORY_VIEWER_URL ?? "http://127.0.0.1:3113";
const AGENTMEMORY_HEALTH_URL =
  process.env.CORTEX_AGENTMEMORY_HEALTH_URL ?? "http://127.0.0.1:3111/agentmemory/health";
const AGENTMEMORY_CMD = process.platform === "win32" ? "npx.cmd" : "npx";

type DesktopPrefs = { startAgentMemoryWithCortex: boolean };
let desktopPrefs: DesktopPrefs = {
  startAgentMemoryWithCortex: process.env.CORTEX_MANAGE_AGENTMEMORY?.toLowerCase() === "true"
};

// ── Backend ───────────────────────────────────────────────────────────────────

/** Same resolution as backend `env.ts`: repo `.env` wins, else `backend/.env`. */
function resolveEnvFileForBackendSpawn(): string | null {
  const rootEnv = path.join(__dirname, "../../.env");
  const backendEnv = path.join(__dirname, "../../backend/.env");
  if (fs.existsSync(rootEnv)) return rootEnv;
  if (fs.existsSync(backendEnv)) return backendEnv;
  return null;
}

function parseDotEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFile(): Record<string, string> {
  const envFile = isDev
    ? resolveEnvFileForBackendSpawn()
    : path.join(path.dirname(app.getPath("exe")), ".env");
  if (envFile && fs.existsSync(envFile)) {
    return parseDotEnvFile(envFile);
  }
  return {};
}

async function waitForBackendHealth(maxMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:4000/api/health");
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function initBackendDatabase(dbPath: string, backendRoot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["prisma", "db", "push", "--skip-generate"],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        shell: true,
        stdio: "pipe",
      }
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma db push exited ${code}`));
    });
    child.on("error", reject);
  });
}

function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "cortex.db");
  const backendRoot = isDev
    ? path.join(__dirname, "../../backend")
    : path.join(process.resourcesPath!, "backend");
  const serverPath = path.join(backendRoot, "dist/src/server.js");

  cachedEnv = loadEnvFile();

  void initBackendDatabase(dbPath, backendRoot)
    .catch((err) => console.warn("[backend] prisma init:", err))
    .finally(() => {
  backendProcess = spawn("node", [serverPath], {
    env: {
      ...process.env,
      ...cachedEnv,
      DATABASE_URL: `file:${dbPath}`,
      NODE_ENV: "production",
      PORT: "4000",
      CORTEX_FRONTEND_URL: "http://localhost:5173",
      ALLOW_FIREBASE_ENV_SYNC: cachedEnv.ALLOW_FIREBASE_ENV_SYNC ?? "true",
    },
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (d: Buffer) =>
    console.log("[backend]", d.toString().trim())
  );
  backendProcess.stderr?.on("data", (d: Buffer) =>
    console.error("[backend]", d.toString().trim())
  );
  backendProcess.on("exit", (code) =>
    console.log("[backend] exited with code", code)
  );
    });
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0e0e10",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0e0e10",
      symbolColor: "#f0f0f5",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Open external links in the browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, "../../frontend/dist/index.html")
    );
  }
}

// ── OAuth deep-link handling ──────────────────────────────────────────────────
// Spotify/Gmail OAuth redirects go to localhost:4000, which redirects back
// to the frontend. No custom protocol needed.

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("get-version", () => app.getVersion());

function getDesktopPrefsPath(): string {
  return path.join(app.getPath("userData"), "desktop-settings.json");
}

function readDesktopPrefs(): DesktopPrefs {
  const prefsPath = getDesktopPrefsPath();
  if (!fs.existsSync(prefsPath)) return desktopPrefs;
  try {
    const parsed = JSON.parse(fs.readFileSync(prefsPath, "utf8")) as Partial<DesktopPrefs>;
    return {
      startAgentMemoryWithCortex:
        parsed.startAgentMemoryWithCortex ?? desktopPrefs.startAgentMemoryWithCortex
    };
  } catch {
    return desktopPrefs;
  }
}

function writeDesktopPrefs(next: DesktopPrefs): void {
  fs.writeFileSync(getDesktopPrefsPath(), JSON.stringify(next, null, 2), "utf8");
}

async function pingAgentMemoryHealth(): Promise<boolean> {
  try {
    const res = await fetch(AGENTMEMORY_HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function buildMemoryStatus() {
  const running = memoryProcess !== null && !memoryProcess.killed;
  return {
    managed: desktopPrefs.startAgentMemoryWithCortex,
    running,
    online: running || memoryOnline,
    viewerUrl: AGENTMEMORY_VIEWER_URL
  };
}

function startAgentMemory(): void {
  if (memoryProcess) return;
  memoryProcess = spawn(AGENTMEMORY_CMD, ["-y", "@agentmemory/agentmemory"], {
    env: process.env,
    stdio: "pipe"
  });
  memoryProcess.on("exit", () => {
    memoryProcess = null;
    void refreshMemoryStatus();
  });
}

function stopAgentMemory(): void {
  memoryProcess?.kill();
  memoryProcess = null;
}

async function refreshMemoryStatus(): Promise<void> {
  memoryOnline = await pingAgentMemoryHealth();
}

ipcMain.handle("memory/getStatus", async () => {
  await refreshMemoryStatus();
  return buildMemoryStatus();
});
ipcMain.handle("memory/openViewer", async () => {
  await shell.openExternal(AGENTMEMORY_VIEWER_URL);
});
ipcMain.handle("memory/copyMcpConfig", () => {
  const cfg = JSON.stringify(
    {
      mcpServers: {
        agentmemory: {
          command: AGENTMEMORY_CMD,
          args: ["-y", "@agentmemory/mcp"],
          env: { AGENTMEMORY_URL: "http://127.0.0.1:3111" }
        }
      }
    },
    null,
    2
  );
  clipboard.writeText(cfg);
  return cfg;
});
ipcMain.handle("memory/setAutostart", async (_event, enabled: boolean) => {
  desktopPrefs = { startAgentMemoryWithCortex: enabled };
  writeDesktopPrefs(desktopPrefs);
  if (enabled) startAgentMemory();
  else stopAgentMemory();
  await refreshMemoryStatus();
  return buildMemoryStatus();
});

ipcMain.handle("auth-desktop-token", async () => {
  const secret = cachedEnv.CORTEX_DESKTOP_SECRET?.trim();
  const headers: Record<string, string> = {};
  if (secret) headers["X-Cortex-Desktop-Secret"] = secret;
  const res = await fetch("http://127.0.0.1:4000/api/auth/desktop-token", { headers });
  const data = (await res.json()) as { token?: string; error?: { message?: string } };
  if (!res.ok || !data.token) {
    throw new Error(data.error?.message ?? `Desktop auth failed (${res.status})`);
  }
  return data.token;
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  cachedEnv = loadEnvFile();
  desktopPrefs = readDesktopPrefs();
  if (desktopPrefs.startAgentMemoryWithCortex) {
    startAgentMemory();
  }
  void refreshMemoryStatus();
  if (!isDev) {
    startBackend();
  }
  void (async () => {
    if (!isDev) {
      await waitForBackendHealth();
    } else {
      await waitForBackendHealth(15_000);
    }
    createWindow();
  })();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  backendProcess?.kill();
  memoryProcess?.kill();
});
