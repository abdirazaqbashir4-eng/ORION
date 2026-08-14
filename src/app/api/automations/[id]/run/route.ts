import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runAutomation } from "@/lib/automations/engine";
import type { Automation } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!features.database) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;

  // RLS confirms this automation actually belongs to the signed-in user
  // before we hand it to the service-role executor.
  const supabase = createServerSupabaseClient();
  const { data: automation, error } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !automation) {
    return NextResponse.json({ error: "Automation not found." }, { status: 404 });
  }

  const result = await runAutomation(automation as Automation);
  return NextResponse.json(result);
}
