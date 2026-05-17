import { app, BrowserWindow, shell, ipcMain, protocol } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let backendProcess: ChildProcess | null = null;
let ollamaProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

// ── Custom protocol — register before app is ready ────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("cortex", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("cortex");
}

// Enforce single instance so OAuth deep-links route to the running window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Windows: deep-link arrives as a command-line arg in a second instance
app.on("second-instance", (_event, argv) => {
  const url = argv.find((a) => a.startsWith("cortex://"));
  if (url) handleDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: deep-link arrives via open-url event
app.on("open-url", (_event, url) => handleDeepLink(url));

// ── Deep-link handler ─────────────────────────────────────────────────────────

function handleDeepLink(url: string) {
  console.log("[electron] deep-link:", url);
  // cortex://oauth/callback?code=...&state=...
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    const error = parsed.searchParams.get("error");

    if (parsed.pathname.includes("spotify")) {
      // Spotify: custom-scheme redirect carries code — frontend exchanges it
      mainWindow?.webContents.executeJavaScript(
        `window.__handleOAuth && window.__handleOAuth("spotify", ${JSON.stringify({ code, state, error })})`
      );
    } else if (parsed.pathname.includes("notion")) {
      mainWindow?.webContents.executeJavaScript(
        `window.__handleOAuth && window.__handleOAuth("notion", ${JSON.stringify({ code, state, error })})`
      );
    } else if (parsed.pathname.includes("mail")) {
      // Multi-account Mail: backend already exchanged the code server-side
      const connected = parsed.searchParams.get("connected");
      const email = parsed.searchParams.get("email");
      mainWindow?.webContents.executeJavaScript(
        `window.__handleOAuth && window.__handleOAuth("mail", ${JSON.stringify({ connected, email, error })})`
      );
    } else if (parsed.pathname.includes("microsoft")) {
      const connected = parsed.searchParams.get("connected");
      const email = parsed.searchParams.get("email");
      mainWindow?.webContents.executeJavaScript(
        `window.__handleOAuth && window.__handleOAuth("microsoft", ${JSON.stringify({ connected, email, error })})`
      );
    } else if (parsed.pathname.includes("google") || parsed.pathname.includes("gmail")) {
      const connected = parsed.searchParams.get("connected");
      if (connected) {
        // Gmail: backend already exchanged the code server-side; this is just a notification
        mainWindow?.webContents.executeJavaScript(
          `window.__handleOAuth && window.__handleOAuth("google", ${JSON.stringify({ connected: "1" })})`
        );
      } else {
        // Fallback: code in URL (not currently used for Google but handled for completeness)
        mainWindow?.webContents.executeJavaScript(
          `window.__handleOAuth && window.__handleOAuth("google", ${JSON.stringify({ code, state, error })})`
        );
      }
    }
  } catch (e) {
    console.error("[electron] deep-link parse error:", e);
  }
}

// ── Backend ───────────────────────────────────────────────────────────────────

function getEnvPath(): string {
  return isDev
    ? path.join(__dirname, "../../.env.local")
    : path.join(path.dirname(app.getPath("exe")), ".env.local");
}

function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "cortex.db");
  const serverPath = isDev
    ? path.join(__dirname, "../../backend/dist/src/server.js")
    : path.join(process.resourcesPath!, "backend/dist/src/server.js");

  const extraEnv: Record<string, string> = {};
  const envFile = getEnvPath();
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) {
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        extraEnv[k] = v;
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
      SPOTIFY_REDIRECT_URI: "cortex://oauth/spotify",
      NOTION_REDIRECT_URI: "cortex://oauth/notion",
      GOOGLE_REDIRECT_URI: "cortex://oauth/google",
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
      sandbox: false, // required: ESM preload needs sandbox disabled
    },
    show: true,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
    const viteUrl = process.env.CORTEX_VITE_URL ?? "http://localhost:5173";
    void mainWindow.loadURL(viteUrl);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, "../../frontend/dist/index.html")
    );
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("get-version", () => app.getVersion());
ipcMain.handle("open-external", (_e, url: string) => shell.openExternal(url));

ipcMain.handle("start-ollama", () => {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    // Already running
    if (ollamaProcess && !ollamaProcess.killed) {
      resolve({ ok: true });
      return;
    }
    try {
      ollamaProcess = spawn("ollama", ["serve"], {
        detached: false,
        stdio: "pipe",
        shell: process.platform === "win32",
      });
      ollamaProcess.stdout?.on("data", (d: Buffer) =>
        console.log("[ollama]", d.toString().trim())
      );
      ollamaProcess.stderr?.on("data", (d: Buffer) =>
        console.log("[ollama]", d.toString().trim())
      );
      ollamaProcess.on("error", (err) => {
        console.error("[ollama] failed to start:", err.message);
        resolve({ ok: false, error: err.message });
      });
      // Give it 1.5 s to either error out or start listening
      setTimeout(() => resolve({ ok: true }), 1500);
    } catch (err) {
      resolve({ ok: false, error: String(err) });
    }
  });
});

ipcMain.handle("ollama-status", () => ({
  running: !!(ollamaProcess && !ollamaProcess.killed),
}));

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (!isDev) startBackend(); // dev:backend script handles it in dev mode
  setTimeout(createWindow, isDev ? 0 : 1500);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  backendProcess?.kill();
  ollamaProcess?.kill();
});
