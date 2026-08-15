import "server-only";
import { google } from "googleapis";
import { env, features } from "@/lib/env";
import { encrypt, decrypt } from "@/lib/security/crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuthClient() {
  if (!features.email) throw new Error("Google OAuth is not configured.");
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl(state: string) {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function handleGoogleCallback(code: string, userId: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("oauth_connections").upsert(
    {
      user_id: userId,
      provider: "google",
      encrypted_access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
      encrypted_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      scope: tokens.scope ?? null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function isGmailConnected(userId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("oauth_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getGmailClientForUser(userId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("oauth_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw error;
  if (!data?.encrypted_refresh_token) return null;

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: decrypt(data.encrypted_refresh_token),
    access_token: data.encrypted_access_token ? decrypt(data.encrypted_access_token) : undefined,
  });

  // googleapis auto-refreshes expired access tokens; persist the rotated
  // token so the next request doesn't have to round-trip the refresh flow.
  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void supabase
      .from("oauth_connections")
      .update({
        encrypted_access_token: encrypt(tokens.access_token),
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      })
      .eq("user_id", userId)
      .eq("provider", "google");
  });

  return google.gmail({ version: "v1", auth: client });
}
