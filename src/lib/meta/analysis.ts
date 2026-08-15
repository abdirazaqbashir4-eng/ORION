import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CHAT_MODEL } from "@/lib/ai/anthropic";
import type { CampaignWithInsights } from "./types";

export interface CampaignMetric {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
}

function conversionsFromInsights(insights: CampaignWithInsights["insights"]): number {
  if (!insights?.actions) return 0;
  return insights.actions
    .filter((a) => /purchase|lead|conversion|complete_registration/.test(a.action_type))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

export function toCampaignMetrics(campaigns: CampaignWithInsights[]): CampaignMetric[] {
  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.effective_status,
    spend: Number(c.insights?.spend ?? 0),
    impressions: Number(c.insights?.impressions ?? 0),
    clicks: Number(c.insights?.clicks ?? 0),
    ctr: Number(c.insights?.ctr ?? 0),
    cpc: Number(c.insights?.cpc ?? 0),
    cpm: Number(c.insights?.cpm ?? 0),
    conversions: conversionsFromInsights(c.insights),
  }));
}

export interface UnderperformingCampaign extends CampaignMetric {
  reasons: string[];
}

/**
 * Flags campaigns performing meaningfully worse than the account's own
 * average — relative to your other campaigns, not an arbitrary external
 * benchmark. Needs spend > 0 to avoid flagging fresh/paused campaigns
 * with no data as "underperforming".
 */
export function identifyUnderperforming(metrics: CampaignMetric[]): UnderperformingCampaign[] {
  const spending = metrics.filter((m) => m.spend > 0);
  if (spending.length < 2) return [];

  const avgCtr = spending.reduce((s, m) => s + m.ctr, 0) / spending.length;
  const avgCpc = spending.reduce((s, m) => s + m.cpc, 0) / spending.length;

  const flagged: UnderperformingCampaign[] = [];
  for (const m of spending) {
    const reasons: string[] = [];
    if (m.ctr < avgCtr * 0.6) reasons.push(`CTR ${m.ctr.toFixed(2)}% is well below account average (${avgCtr.toFixed(2)}%)`);
    if (m.cpc > avgCpc * 1.5) reasons.push(`CPC $${m.cpc.toFixed(2)} is well above account average ($${avgCpc.toFixed(2)})`);
    if (m.clicks > 100 && m.conversions === 0) reasons.push(`${m.clicks} clicks with zero tracked conversions`);
    if (reasons.length > 0) flagged.push({ ...m, reasons });
  }
  return flagged;
}

export function compareCampaigns(metrics: CampaignMetric[]) {
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  return [...metrics]
    .sort((a, b) => b.spend - a.spend)
    .map((m) => ({ ...m, spendShare: totalSpend > 0 ? m.spend / totalSpend : 0 }));
}

function firstText(res: Anthropic.Messages.Message): string {
  return res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";
}

/** AI-generated recommendations from real campaign metrics — no fabricated numbers, only what's passed in. */
export async function generateAdRecommendations(
  metrics: CampaignMetric[],
  underperforming: UnderperformingCampaign[]
): Promise<string[]> {
  const anthropic = getAnthropicClient();
  const res = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system:
      'You are ORION\'s Marketing Agent analyzing real Meta Ads performance data. Given campaign metrics and flagged underperformers, respond with ONLY a JSON array of 3-6 short, specific, actionable recommendations (e.g. "Pause \'Spring Sale\' — CPC is 2.3x account average with zero conversions"). Base every recommendation strictly on the provided numbers. No prose, no markdown fences.',
    messages: [{ role: "user", content: JSON.stringify({ metrics, underperforming }) }],
  });

  const match = firstText(res).match(/\[[\s\S]*\]/);
  try {
    return JSON.parse(match?.[0] ?? "[]") as string[];
  } catch {
    return [];
  }
}
