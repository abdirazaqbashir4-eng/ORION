import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Minimal, self-contained server output — bundled into the Electron
  // desktop build (see electron/main.js) so the .exe carries its own
  // Next.js server instead of depending on `npm install` at the target.
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

// withSentryConfig no-ops cleanly when NEXT_PUBLIC_SENTRY_DSN / SENTRY_AUTH_TOKEN
// aren't set (see src/instrumentation.ts + instrumentation-client.ts, which
// also gate actual Sentry.init on the DSN being present).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false,
});
