import { app, BrowserWindow, shell, ipcMain } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let backendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

// ── Backend ───────────────────────────────────────────────────────────────────

function getEnvPath(): string {
  // In dev: repo root .env.local, in prod: next to the exe
  return isDev
    ? path.join(__dirname, "../../.env.local")
    : path.join(path.dirname(app.getPath("exe")), ".env.local");
}

function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "cortex.db");
  const serverPath = isDev
    ? path.join(__dirname, "../../backend/dist/src/server.js")
    : path.join(process.resourcesPath!, "backend/dist/src/server.js");

  // Load .env.local if it exists
  const envFile = getEnvPath();
  const extraEnv: Record<string, string> = {};
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf8").split("\n");
    for (const line of lines) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) {
        extraEnv[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  backendProcess = spawn("node", [serverPath], {
    env: {
      ...process.env,
      ...extraEnv,
      DATABASE_URL: `file:${dbPath}`,
      NODE_ENV: "production",
      PORT: "4000",
      CORTEX_FRONTEND_URL: "cortex://app",
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

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startBackend();
  // Give backend 1.5s to start before loading frontend
  setTimeout(createWindow, 1500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  backendProcess?.kill();
});
