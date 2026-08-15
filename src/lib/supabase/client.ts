"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { env, features } from "@/lib/env";

/**
 * Browser-side, RLS-respecting Supabase client bound to the current
 * Clerk session. Use for realtime subscriptions (chat streaming, live
 * task/notification updates) from Client Components.
 */
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    if (!features.database) return null;

    return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      async accessToken() {
        return session?.getToken() ?? null;
      },
    });
  }, [session]);
}
