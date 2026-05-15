import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("get-version"),
  /** Main process calls /auth/desktop-token with the desktop secret (never exposed to the page). */
  requestDesktopAuth: (): Promise<string> => ipcRenderer.invoke("auth-desktop-token"),
  getMemoryStatus: () => ipcRenderer.invoke("memory/getStatus"),
  openMemoryViewer: () => ipcRenderer.invoke("memory/openViewer"),
  copyMemoryMcpConfig: () => ipcRenderer.invoke("memory/copyMcpConfig"),
  setMemoryAutostart: (enabled: boolean) => ipcRenderer.invoke("memory/setAutostart", enabled)
});
