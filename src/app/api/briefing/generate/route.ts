import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { runDailyBriefing } from "@/lib/automations/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!features.database) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const result = await runDailyBriefing(user.id);
  return NextResponse.json(result);
}
