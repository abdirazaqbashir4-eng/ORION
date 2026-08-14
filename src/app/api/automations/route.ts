import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeNextRunAt } from "@/lib/automations/engine";

export const runtime = "nodejs";

const DEFAULT_AUTOMATIONS = [
  {
    name: "Morning Briefing",
    description: "Checks email, gathers business metrics, and creates the daily briefing.",
    action_type: "daily_briefing",
    schedule_cron: "0 7 * * *",
  },
  {
    name: "Evening Summary",
    description: "Summarizes the day and drafts tomorrow's priorities.",
    action_type: "evening_summary",
    schedule_cron: "0 21 * * *",
  },
];

export async function GET() {
  if (!features.database) return NextResponse.json({ automations: [] });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("automations")
    .select("*, automation_runs(status, started_at, finished_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return NextResponse.json({ automations: data });
}

/** Seeds the two standard automations for the signed-in user if they don't exist yet. */
export async function POST() {
  if (!features.database) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data: existing } = await supabase.from("automations").select("action_type").eq("user_id", user.id);
  const existingTypes = new Set((existing ?? []).map((a) => a.action_type));

  const toCreate = DEFAULT_AUTOMATIONS.filter((a) => !existingTypes.has(a.action_type)).map((a) => ({
    user_id: user.id,
    name: a.name,
    description: a.description,
    trigger_type: "schedule" as const,
    schedule_cron: a.schedule_cron,
    action_type: a.action_type,
    next_run_at: computeNextRunAt(a.schedule_cron),
  }));

  if (toCreate.length === 0) return NextResponse.json({ created: 0 });

  const { error } = await supabase.from("automations").insert(toCreate);
  if (error) throw error;

  return NextResponse.json({ created: toCreate.length });
}
