import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("get-version"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
});
