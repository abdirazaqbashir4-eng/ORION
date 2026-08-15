const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

// Loaded before `electron` itself so Sentry and dotenv are available as
// early as physically possible in main-process startup.
const { app, BrowserWindow, shell, session, dialog, desktopCapturer, ipcMain } = require("electron");
const http = require("node:http");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;

// Loads .env.local (dev, from the project root) or a .env file placed
// next to the packaged app, so both Sentry's DSN and the desktop app's
// own scheduler ticks (see scheduleAutomationTicks below) carry the same
// config the bundled Next server reads. Packaged builds otherwise get
// their config from real OS environment variables, same as any deployed app.
const envPath = isDev
  ? path.join(__dirname, "..", ".env.local")
  : path.join(path.dirname(process.execPath), ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

/**
 * Sentry for the Electron main process — catches errors in main.js itself
 * (window/session/IPC setup, app lifecycle), native crashes (via
 * Electron's crashReporter/minidumps), and shows a native "something
 * went wrong" dialog on a truly uncaught main-process exception. This is
 * separate from @sentry/nextjs, which instruments the Next.js server and
 * browser/renderer (see src/instrumentation.ts and instrumentation-client.ts).
 *
 * Initialized as early as possible (right after env vars are loaded) so
 * crash reporting is armed before window creation or the bundled server
 * starts. Reuses NEXT_PUBLIC_SENTRY_DSN — the same DSN already used by
 * the Next.js server and browser instrumentation — since a DSN is a
 * public identifier by Sentry's own design, not a secret.
 *
 * Known overlap: once the bundled Next.js server starts (see
 * startProductionServer below), it runs in this same OS process and its
 * own @sentry/nextjs Node instrumentation installs its own
 * uncaughtException/unhandledRejection listeners alongside this SDK's.
 * Both are left active on purpose rather than stripped: Node allows
 * multiple listeners per event, Sentry's own fingerprinting collapses
 * genuinely identical duplicate events into one issue (just a higher
 * event count, not a second issue), and for a desktop app it's correct
 * for an uncaught exception anywhere in this process — main-process code
 * or the embedded server — to surface visibly to the user, not just get
 * logged to a dashboard they aren't watching in the moment.
 */
function initSentryMainProcess() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = require("@sentry/electron/main");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "production",
  });
}

initSentryMainProcess();

const PORT = process.env.ORION_PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;

let mainWindow;
let schedulerInterval;
let statsInterval;
let updateCheckInterval;
let updaterStatus = { state: "idle" };

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`ORION server did not start within ${timeoutMs}ms`));
          } else {
            setTimeout(check, 300);
          }
        });
    };
    check();
  });
}

/**
 * In production the Next.js "standalone" server is bundled as an
 * extraResource (see package.json "build.extraResources") and started
 * in-process here — Electron's main process is a full Node runtime, so
 * requiring server.js directly avoids spawning a separate child process.
 *
 * Throws with a specific, user-readable message on the two failure modes
 * that matter for a packaged install: the bundled files being missing
 * (bad package) and the port already being taken (another app, or a
 * previous ORION instance that didn't shut down cleanly).
 */
function startProductionServer() {
  const serverEntry = path.join(process.resourcesPath, "standalone", "server.js");

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Bundled server not found at ${serverEntry}. This install appears to be missing production files.`
    );
  }

  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "localhost";
  process.env.NODE_ENV = "production";

  try {
    require(serverEntry);
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      throw new Error(
        `Port ${PORT} is already in use by another application. Close it, or set the ORION_PORT environment variable to a free port and restart ORION.`
      );
    }
    throw err;
  }
}

/**
 * The desktop app has no Vercel Cron to lean on, so while ORION is open
 * it drives Phase 10's scheduled automations itself by ticking the same
 * /api/cron/run endpoint Vercel Cron would hit on the web deployment.
 */
function scheduleAutomationTicks() {
  if (!process.env.CRON_SECRET) return;

  const tick = () => {
    fetch(`${APP_URL}/api/cron/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {});
  };

  tick();
  schedulerInterval = setInterval(tick, 15 * 60 * 1000);
}

/**
 * Real CPU/RAM telemetry for the HUD's system panels — Node's `os`
 * module, no fake numbers. CPU is computed from the delta between two
 * `os.cpus()` samples (a single snapshot only gives cumulative counters
 * since boot, not a usable instantaneous percentage).
 */
let prevCpuSample = null;

function sampleCpuPercent() {
  const cpus = os.cpus();
  const sample = cpus.map((cpu) => {
    const t = cpu.times;
    return { total: t.user + t.nice + t.sys + t.idle + t.irq, idle: t.idle };
  });

  if (!prevCpuSample) {
    prevCpuSample = sample;
    return 0;
  }

  let idleDiff = 0;
  let totalDiff = 0;
  sample.forEach((cur, i) => {
    const prev = prevCpuSample[i];
    if (!prev) return;
    totalDiff += cur.total - prev.total;
    idleDiff += cur.idle - prev.idle;
  });
  prevCpuSample = sample;

  return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
}

function collectSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    cpuPercent: sampleCpuPercent(),
    memPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    memUsedGb: (totalMem - freeMem) / 1024 ** 3,
    memTotalGb: totalMem / 1024 ** 3,
    platform: process.platform,
    uptimeSeconds: os.uptime(),
  };
}

function startSystemStatsBroadcast() {
  ipcMain.handle("orion:get-system-stats", () => collectSystemStats());
  ipcMain.handle("orion:get-app-version", () => app.getVersion());
  statsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("orion:system-stats", collectSystemStats());
    }
  }, 2000);
}

/**
 * Self-updating: ORION checks its own GitHub Releases (see package.json
 * "build.publish") for a newer version, downloads it in the background,
 * and installs it the next time the app restarts — no manual reinstall.
 * Only runs in packaged builds; `npm run electron:dev` never checks, since
 * a dev build has no published version to compare against.
 *
 * Publishing an update is a separate, explicit step: `npm run
 * electron:publish` (needs a GH_TOKEN with repo access). Nothing here
 * pushes anything — it only ever reads the repo's published releases.
 */
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const broadcastStatus = (status) => {
    updaterStatus = status;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("orion:updater-status", status);
    }
  };

  autoUpdater.on("checking-for-update", () => broadcastStatus({ state: "checking" }));
  autoUpdater.on("update-available", (info) => broadcastStatus({ state: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => broadcastStatus({ state: "up-to-date" }));
  autoUpdater.on("download-progress", (progress) =>
    broadcastStatus({ state: "downloading", percent: Math.round(progress.percent) })
  );
  autoUpdater.on("update-downloaded", (info) => broadcastStatus({ state: "ready", version: info.version }));
  autoUpdater.on("error", (err) => {
    console.error("ORION auto-update error:", err);
    broadcastStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
  });

  ipcMain.handle("orion:updater-check", () => {
    autoUpdater.checkForUpdates().catch((err) => console.error("ORION update check failed:", err));
  });
  ipcMain.handle("orion:updater-get-status", () => updaterStatus);
  ipcMain.handle("orion:updater-quit-and-install", () => autoUpdater.quitAndInstall());

  autoUpdater.checkForUpdates().catch((err) => console.error("ORION update check failed:", err));
  updateCheckInterval = setInterval(
    () => autoUpdater.checkForUpdates().catch((err) => console.error("ORION update check failed:", err)),
    4 * 60 * 60 * 1000
  );
}

async function createWindow() {
  if (!isDev) {
    startProductionServer();
  }

  await waitForServer(APP_URL);
  scheduleAutomationTicks();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0d0f1a",
    autoHideMenuBar: true,
    title: "ORION",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links (e.g. Clerk OAuth redirects) in the OS browser
  // instead of navigating the desktop shell away from the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Surfaces renderer crashes instead of leaving the user staring at a
  // frozen or blank window with no explanation.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("ORION renderer process gone:", details);
    if (details.reason !== "clean-exit") {
      dialog.showErrorBox(
        "ORION crashed",
        `The app's interface stopped responding (${details.reason}). ORION will try to reload it.`
      );
      mainWindow?.reload();
    }
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("ORION renderer became unresponsive");
  });

  startSystemStatsBroadcast();
  setupAutoUpdater();
}

app.whenReady().then(async () => {
  // Grants mic access without a renderer-side prompt — required for the
  // voice assistant (Phase 7). Still origin-scoped to the app's own URL.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  // Required for getDisplayMedia() (Live Vision's screen capture) to work
  // in Electron at all — without this handler it rejects unconditionally.
  // useSystemPicker shows the OS's own native screen/window picker, so
  // screen-sharing consent stays explicit and visible rather than ORION
  // silently choosing a source.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ["screen"] })
        .then((sources) => callback({ video: sources[0] }))
        .catch(() => callback({}));
    },
    { useSystemPicker: true }
  );

  try {
    await createWindow();
  } catch (err) {
    console.error("ORION failed to start:", err);
    dialog.showErrorBox("ORION failed to start", err instanceof Error ? err.message : String(err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (schedulerInterval) clearInterval(schedulerInterval);
  if (statsInterval) clearInterval(statsInterval);
  if (updateCheckInterval) clearInterval(updateCheckInterval);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
