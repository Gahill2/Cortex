import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("get-version"),
});
