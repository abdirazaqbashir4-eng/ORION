import "server-only";
import { CronExpressionParser } from "cron-parser";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { Automation } from "@/lib/supabase/types";
import { runDailyBriefing, runEveningSummary } from "./actions";

export function computeNextRunAt(cronExpression: string, fromDate = new Date()): string {
  const interval = CronExpressionParser.parse(cronExpression, { currentDate: fromDate });
  return interval.next().toDate().toISOString();
}

async function dispatch(automation: Automation) {
  switch (automation.action_type) {
    case "daily_briefing":
      return runDailyBriefing(automation.user_id);
    case "evening_summary":
      return runEveningSummary(automation.user_id);
    default:
      throw new Error(`Unknown automation action_type: ${automation.action_type}`);
  }
}

export async function runAutomation(automation: Automation) {
  const supabase = createServiceSupabaseClient();
  const { data: run, error: runError } = await supabase
    .from("automation_runs")
    .insert({ automation_id: automation.id, status: "running" })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    const output = await dispatch(automation);

    await supabase
      .from("automation_runs")
      .update({ status: "success", output, finished_at: new Date().toISOString() })
      .eq("id", run.id);

    const update: Record<string, unknown> = { last_run_at: new Date().toISOString() };
    if (automation.trigger_type === "schedule" && automation.schedule_cron) {
      update.next_run_at = computeNextRunAt(automation.schedule_cron);
    }
    await supabase.from("automations").update(update).eq("id", automation.id);

    return { success: true as const, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return { success: false as const, error: message };
  }
}

/** Called by /api/cron/run — finds and executes every automation across every user that's due. */
export async function runDueAutomations() {
  const supabase = createServiceSupabaseClient();
  const { data: due, error } = await supabase
    .from("automations")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString());
  if (error) throw error;

  const results = await Promise.all((due ?? []).map((automation) => runAutomation(automation as Automation)));
  return { checked: due?.length ?? 0, results };
}
