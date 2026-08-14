import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { features } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scrapeUrl, searchWeb } from "@/lib/browser/playwright-runner";
import type { AgentType } from "./types";

const businessMetricsTool: Anthropic.Tool = {
  name: "get_business_metrics",
  description:
    "Query the signed-in user's recorded business metrics (revenue, expenses, profit) for a date range. Use this whenever the user asks about their actual numbers.",
  input_schema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Inclusive start date, YYYY-MM-DD" },
      end_date: { type: "string", description: "Inclusive end date, YYYY-MM-DD" },
    },
    required: ["start_date", "end_date"],
  },
};

const browseWebTool: Anthropic.Tool = {
  name: "browse_web",
  description:
    "Search the web or fetch a specific page's text content using a real browser. Use this for competitor research, market/trend research, or verifying current information you're not certain about.",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["search", "scrape"], description: "search the web, or scrape a specific URL" },
      query: { type: "string", description: "Search query — required when mode is 'search'" },
      url: { type: "string", description: "Page URL — required when mode is 'scrape'" },
    },
    required: ["mode"],
  },
};

export function getToolsForAgent(agentType: AgentType | "general"): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];
  if (agentType === "business" || agentType === "executive") tools.push(businessMetricsTool);
  if (
    (agentType === "research" || agentType === "marketing" || agentType === "executive") &&
    features.browserAutomation
  ) {
    tools.push(browseWebTool);
  }
  return tools;
}

async function executeBusinessMetricsTool(
  input: { start_date: string; end_date: string },
  userId: string | null
): Promise<string> {
  if (!userId) {
    return JSON.stringify({ error: "No signed-in user with a connected database." });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("business_metrics")
    .select("metric_date, revenue, expenses, profit, product, source")
    .eq("user_id", userId)
    .gte("metric_date", input.start_date)
    .lte("metric_date", input.end_date)
    .order("metric_date", { ascending: true });

  if (error) return JSON.stringify({ error: error.message });

  const totals = data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue),
      expenses: acc.expenses + Number(row.expenses),
      profit: acc.profit + Number(row.profit),
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );

  return JSON.stringify({ range: input, totals, rowCount: data.length, rows: data });
}

async function executeBrowseWebTool(
  input: { mode: "search" | "scrape"; query?: string; url?: string },
  userId: string | null
): Promise<string> {
  let result: unknown;
  let error: string | undefined;

  try {
    if (input.mode === "search") {
      if (!input.query) throw new Error("query is required for mode 'search'");
      result = await searchWeb(input.query);
    } else {
      if (!input.url) throw new Error("url is required for mode 'scrape'");
      result = await scrapeUrl(input.url);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Browser automation failed";
  }

  if (userId && features.database) {
    const supabase = createServerSupabaseClient();
    await supabase.from("browser_tasks").insert({
      user_id: userId,
      task_type: input.mode,
      input,
      status: error ? "failed" : "success",
      result: error ? null : result,
      error: error ?? null,
      finished_at: new Date().toISOString(),
    });
  }

  return JSON.stringify(error ? { error } : result);
}

export async function executeTool(
  name: string,
  input: unknown,
  userId: string | null
): Promise<string> {
  switch (name) {
    case "get_business_metrics":
      return executeBusinessMetricsTool(input as { start_date: string; end_date: string }, userId);
    case "browse_web":
      return executeBrowseWebTool(input as { mode: "search" | "scrape"; query?: string; url?: string }, userId);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
