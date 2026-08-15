export {};

export interface SystemStats {
  cpuPercent: number;
  memPercent: number;
  memUsedGb: number;
  memTotalGb: number;
  platform: string;
  uptimeSeconds: number;
}

export type UpdaterStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "up-to-date" }
  | { state: "downloading"; percent: number }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

declare global {
  interface Window {
    /** Present only when running inside the Electron desktop shell. */
    orion?: {
      isDesktop: true;
      platform: NodeJS.Platform;
      versions: { electron: string; chrome: string };
      systemStats: {
        get: () => Promise<SystemStats>;
        subscribe: (callback: (stats: SystemStats) => void) => () => void;
      };
      updater: {
        getCurrentVersion: () => Promise<string>;
        getStatus: () => Promise<UpdaterStatus>;
        check: () => Promise<void>;
        quitAndInstall: () => Promise<void>;
        subscribe: (callback: (status: UpdaterStatus) => void) => () => void;
      };
    };
  }
}
