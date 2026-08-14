export {};

declare global {
  interface Window {
    /** Present only when running inside the Electron desktop shell. */
    orion?: {
      isDesktop: true;
      platform: NodeJS.Platform;
      versions: { electron: string; chrome: string };
    };
  }
}
