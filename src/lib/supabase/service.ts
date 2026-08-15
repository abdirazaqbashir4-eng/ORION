import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 *
 * Only use this for code with no signed-in user in the request path:
 * scheduled automations (Phase 10), agent background runs (Phase 8),
 * and inbound webhooks (Clerk/Gmail). Never import this into a path that
 * handles a user's own request — use `createServerSupabaseClient()`
 * from `./server` there so RLS stays the safety net.
 */
export function createServiceSupabaseClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase service role is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
