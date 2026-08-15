const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orion", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  systemStats: {
    get: () => ipcRenderer.invoke("orion:get-system-stats"),
    subscribe: (callback) => {
      const listener = (_event, stats) => callback(stats);
      ipcRenderer.on("orion:system-stats", listener);
      return () => ipcRenderer.removeListener("orion:system-stats", listener);
    },
  },
  updater: {
    getCurrentVersion: () => ipcRenderer.invoke("orion:get-app-version"),
    getStatus: () => ipcRenderer.invoke("orion:updater-get-status"),
    check: () => ipcRenderer.invoke("orion:updater-check"),
    quitAndInstall: () => ipcRenderer.invoke("orion:updater-quit-and-install"),
    subscribe: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("orion:updater-status", listener);
      return () => ipcRenderer.removeListener("orion:updater-status", listener);
    },
  },
});
