import { env } from "@/lib/env";

export async function register() {
  if (!env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: env.NODE_ENV,
  });
}

interface RequestInfo {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

interface RequestErrorContext {
  routerKind: string;
  routePath: string;
  routeType: string;
}

export async function onRequestError(error: unknown, request: RequestInfo, context: RequestErrorContext) {
  if (!env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
}
