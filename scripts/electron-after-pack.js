const path = require("node:path");
const fs = require("node:fs");

/**
 * electron-builder's `extraResources` copy silently drops the
 * `.next/standalone/node_modules` directory (observed: the source has
 * it, the packaged resources/standalone/ doesn't — likely its file
 * matcher treats any nested `node_modules` specially and excludes it
 * from generic extraResources copies). Without it, the bundled Next.js
 * server fails at launch with "Cannot find module 'next'" — nothing in
 * .next/standalone/server.js works without its own node_modules.
 *
 * This afterPack hook runs once packaging finishes and copies it in
 * directly, verified present, instead of trusting the extraResources
 * config alone.
 */
exports.default = async function afterPack(context) {
  const src = path.join(process.cwd(), ".next", "standalone", "node_modules");
  const dest = path.join(context.appOutDir, "resources", "standalone", "node_modules");

  if (!fs.existsSync(src)) {
    throw new Error(`afterPack: expected ${src} to exist — run "npm run build" first.`);
  }

  fs.cpSync(src, dest, { recursive: true });

  if (!fs.existsSync(path.join(dest, "next"))) {
    throw new Error(`afterPack: copied node_modules to ${dest} but "next" package is still missing.`);
  }

  console.log(`afterPack: copied standalone node_modules -> ${dest}`);
};
