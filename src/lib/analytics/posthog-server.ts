import "server-only";
import { PostHog } from "posthog-node";
import { env, features } from "@/lib/env";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!features.analytics) return null;
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Fire-and-forget server-side event capture — used for agent runs, automation runs, etc. */
export function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  getClient()?.capture({ distinctId, event, properties });
}
