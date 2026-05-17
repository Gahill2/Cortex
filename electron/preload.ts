import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("get-version"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  startOllama: () => ipcRenderer.invoke("start-ollama") as Promise<{ ok: boolean; error?: string }>,
  ollamaStatus: () => ipcRenderer.invoke("ollama-status") as Promise<{ running: boolean }>,
});
