import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!features.email) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  return NextResponse.redirect(getGoogleAuthUrl(state));
}
