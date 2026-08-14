import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "./server";
import type { User } from "./types";

/**
 * Resolves the signed-in Clerk user to their `users` row, creating it on
 * first request. A Clerk `user.created` webhook (Phase 9's webhook
 * infrastructure) would make this eager instead of lazy — this
 * request-time upsert is the simpler bootstrap until that exists.
 */
export async function getCurrentUser(): Promise<User | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const supabase = createServerSupabaseClient();

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUser.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as User;

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_user_id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
      full_name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      avatar_url: clerkUser.imageUrl,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created as User;
}
