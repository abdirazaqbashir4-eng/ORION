import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * In-memory sliding-window rate limiter — correct for a single Node
 * process (the Electron desktop build, or any single-instance
 * deployment). A multi-instance serverless deployment needs a shared
 * store (e.g. Upstash Redis) since each instance has its own memory;
 * swap this implementation for that if ORION scales past one instance.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1 };
  }

  if (bucket.count >= opts.limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: opts.limit - bucket.count };
}

/** Resolves a rate-limit key from a signed-in user id, falling back to request IP. */
export function rateLimitKeyFor(req: Request, userId: string | null, scope: string): string {
  if (userId) return `${scope}:user:${userId}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${scope}:ip:${ip}`;
}
