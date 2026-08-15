import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { env, features } from "@/lib/env";

/**
 * Request-scoped Supabase client for use in Server Components, Route
 * Handlers, and Server Actions. Row Level Security is enforced using the
 * signed-in Clerk user's session token, via Supabase's native third-party
 * auth integration for Clerk (Project Settings -> Auth -> Third Party Auth).
 *
 * This client respects RLS — every `supabase/migrations` policy filters
 * rows to `requesting_clerk_user_id()`, so a signed-in user can only ever
 * read/write their own rows through this client.
 */
export function createServerSupabaseClient() {
  if (!features.database) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    async accessToken() {
      return (await auth()).getToken();
    },
  });
}
