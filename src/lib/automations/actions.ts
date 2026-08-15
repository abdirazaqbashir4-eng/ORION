import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { features } from "@/lib/env";
import { getAnthropicClient, CHAT_MODEL } from "@/lib/ai/anthropic";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { saveMemory } from "@/lib/memory/store";
import { isGmailConnected, getGmailClientForUser } from "@/lib/google/oauth";
import { listRecentEmails } from "@/lib/google/gmail";
import { classifyEmails } from "@/lib/ai/email";
import { listMeetings } from "@/lib/fireflies/client";
import { parseActionItems } from "@/lib/fireflies/types";

function firstText(res: Anthropic.Messages.Message): string {
  return res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";
}

/**
 * Runs as a scheduled/service-role job with no signed-in request — every
 * DB read/write here goes through the service-role client (bypasses RLS
 * by design, see lib/supabase/service.ts) rather than the per-request
 * RLS-scoped client used elsewhere in the app.
 */
export async function runDailyBriefing(userId: string) {
  const supabase = createServiceSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let emailsSummary: Record<string, unknown> = { note: "Gmail not connected." };
  if (features.email && (await isGmailConnected(userId))) {
    const client = await getGmailClientForUser(userId);
    if (client) {
      const emails = await listRecentEmails(userId, { maxResults: 10, query: "is:unread" });
      const classifications = features.ai ? await classifyEmails(emails) : {};
      emailsSummary = {
        unreadCount: emails.length,
        items: emails.map((e) => ({
          subject: e.subject,
          from: e.from,
          ...classifications[e.id],
        })),
      };
    }
  }

  const { data: metrics } = await supabase
    .from("business_metrics")
    .select("metric_date, revenue, expenses, profit")
    .eq("user_id", userId)
    .gte("metric_date", weekAgo);
  const revenueSummary = (metrics ?? []).reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue),
      expenses: acc.expenses + Number(row.expenses),
      profit: acc.profit + Number(row.profit),
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );

  const { data: openTasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date")
    .eq("user_id", userId)
    .in("status", ["pending", "in_progress"])
    .order("priority", { ascending: false })
    .limit(10);
  const tasksSummary = { openCount: openTasks?.length ?? 0, items: openTasks ?? [] };

  const calendarSummary = { note: "Calendar integration not yet connected." };
  const newsSummary = { note: "News integration not yet connected." };

  let meetingsSummary: Record<string, unknown> = { note: "Fireflies not connected." };
  if (features.meetings) {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const meetings = await listMeetings({ fromDate: yesterday, limit: 10 });
      meetingsSummary = {
        count: meetings.length,
        items: meetings.map((m) => ({
          title: m.title,
          date: m.dateString,
          participants: m.participants,
          overview: m.summary?.overview ?? m.summary?.short_summary ?? null,
          actionItems: parseActionItems(m.summary?.action_items),
        })),
      };
    } catch (err) {
      meetingsSummary = { error: err instanceof Error ? err.message : "Failed to load meetings." };
    }
  }

  let summary = "";
  let recommendations: string[] = [];

  if (features.ai) {
    const anthropic = getAnthropicClient();
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system:
        'You write ORION\'s daily briefing. Given structured data, respond with ONLY JSON: {"summary": "2-3 sentence overview", "recommendations": ["short actionable item", ...]}. No prose, no markdown fences.',
      messages: [
        {
          role: "user",
          content: JSON.stringify({ emailsSummary, revenueSummary, tasksSummary, meetingsSummary }),
        },
      ],
    });
    const match = firstText(res).match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(match?.[0] ?? "{}") as { summary?: string; recommendations?: string[] };
      summary = parsed.summary ?? "";
      recommendations = parsed.recommendations ?? [];
    } catch {
      // leave summary/recommendations empty; briefing still saves with raw data
    }
  }

  const { error } = await supabase.from("briefings").upsert(
    {
      user_id: userId,
      briefing_date: today,
      summary,
      emails_summary: emailsSummary,
      revenue_summary: revenueSummary,
      calendar_summary: calendarSummary,
      news_summary: newsSummary,
      tasks_summary: tasksSummary,
      meetings_summary: meetingsSummary,
      recommendations,
    },
    { onConflict: "user_id,briefing_date" }
  );
  if (error) throw error;

  return { summary, recommendations };
}

export async function runEveningSummary(userId: string) {
  const supabase = createServiceSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("title")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("completed_at", startOfDay.toISOString());

  let summaryText = `Completed ${completedTasks?.length ?? 0} task(s) today.`;
  let priorities: string[] = [];

  if (features.ai) {
    const anthropic = getAnthropicClient();
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 512,
      system:
        'Write a one-paragraph end-of-day summary and up to 3 priorities for tomorrow, given today\'s completed tasks. Respond with ONLY JSON: {"summary": "...", "priorities": ["...", ...]}.',
      messages: [{ role: "user", content: JSON.stringify({ completedTasks: completedTasks ?? [] }) }],
    });
    const match = firstText(res).match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(match?.[0] ?? "{}") as { summary?: string; priorities?: string[] };
      summaryText = parsed.summary ?? summaryText;
      priorities = parsed.priorities ?? [];
    } catch {
      // fall back to the plain completedTasks-count summary above
    }
  }

  if (features.embeddings) {
    await saveMemory(userId, {
      type: "note",
      content: `Evening summary: ${summaryText}${priorities.length ? `\nTomorrow's priorities: ${priorities.join("; ")}` : ""}`,
      source: "evening_summary",
    });
  }

  if (priorities.length > 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await supabase.from("tasks").insert(
      priorities.map((title) => ({
        user_id: userId,
        title,
        priority: "medium" as const,
        due_date: tomorrow.toISOString(),
        metadata: { source: "evening_summary" },
      }))
    );
  }

  return { summary: summaryText, priorities };
}
