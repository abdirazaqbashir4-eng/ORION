import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { handleGoogleCallback } from "@/lib/google/oauth";
import { logAuditEvent } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/email?error=${encodeURIComponent(oauthError)}`, env.NEXT_PUBLIC_APP_URL));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/email?error=missing_code", env.NEXT_PUBLIC_APP_URL));
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", env.NEXT_PUBLIC_APP_URL));
  }

  await handleGoogleCallback(code, user.id);
  await logAuditEvent(user.id, "oauth_connected", { provider: "google" });
  return NextResponse.redirect(new URL("/email?connected=1", env.NEXT_PUBLIC_APP_URL));
}
