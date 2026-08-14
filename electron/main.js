const { app, BrowserWindow, shell, session } = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const isDev = !app.isPackaged;

// Loads .env.local (dev, from the project root) or a .env file placed
// next to the packaged app, so the desktop build's own scheduler ticks
// (see scheduleAutomationTicks below) can carry CRON_SECRET the same way
// the bundled Next server does. Packaged builds otherwise get their
// config from real OS environment variables, same as any deployed app.
const envPath = isDev
  ? path.join(__dirname, "..", ".env.local")
  : path.join(path.dirname(process.execPath), ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const PORT = process.env.ORION_PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;

let mainWindow;
let schedulerInterval;

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
 */
function startProductionServer() {
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "localhost";
  process.env.NODE_ENV = "production";
  require(path.join(process.resourcesPath, "standalone", "server.js"));
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
}

app.whenReady().then(() => {
  // Grants mic access without a renderer-side prompt — required for the
  // voice assistant (Phase 7). Still origin-scoped to the app's own URL.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });
  return createWindow();
});

app.on("window-all-closed", () => {
  if (schedulerInterval) clearInterval(schedulerInterval);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
