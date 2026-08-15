import "server-only";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  MetaAdAccount,
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsights,
  CampaignWithInsights,
  MetaCampaignStatus,
} from "./types";

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

const GRAPH_BASE = "https://graph.facebook.com";

function assertConfigured() {
  if (!features.metaAds) {
    throw new MetaApiError("Meta Marketing API is not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.");
  }
}

async function metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  assertConfigured();

  const url = new URL(`${GRAPH_BASE}/${env.META_API_VERSION}/${path}`);
  url.searchParams.set("access_token", env.META_ACCESS_TOKEN!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  const body = await res.json();

  if (!res.ok || body.error) {
    logger.error("meta.request_failed", { path, status: res.status, error: body.error });
    throw new MetaApiError(body.error?.message ?? `Meta API request failed (${res.status})`, res.status, body.error);
  }

  return body as T;
}

async function metaPost<T>(path: string, params: Record<string, string>): Promise<T> {
  assertConfigured();

  const url = new URL(`${GRAPH_BASE}/${env.META_API_VERSION}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: env.META_ACCESS_TOKEN! });

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();

  if (!res.ok || data.error) {
    logger.error("meta.write_failed", { path, status: res.status, error: data.error });
    throw new MetaApiError(data.error?.message ?? `Meta API write failed (${res.status})`, res.status, data.error);
  }

  return data as T;
}

const CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time";
const INSIGHTS_FIELDS = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,date_start,date_stop";

export async function listAdAccounts(): Promise<MetaAdAccount[]> {
  assertConfigured();
  const data = await metaGet<{ data: MetaAdAccount[] }>("me/adaccounts", {
    fields: "id,name,account_status,currency,timezone_name",
  });
  return data.data;
}

export interface ListCampaignsOptions {
  datePreset?: string; // e.g. "last_7d", "last_30d", "this_month"
  limit?: number;
}

/** Lists campaigns with their performance insights in a single request (Meta's nested field expansion). */
export async function listCampaignsWithInsights(opts: ListCampaignsOptions = {}): Promise<CampaignWithInsights[]> {
  const accountId = env.META_AD_ACCOUNT_ID!;
  const datePreset = opts.datePreset ?? "last_30d";

  const data = await metaGet<{ data: (MetaCampaign & { insights?: { data: MetaInsights[] } })[] }>(
    `${accountId}/campaigns`,
    {
      fields: `${CAMPAIGN_FIELDS},insights.date_preset(${datePreset}){${INSIGHTS_FIELDS}}`,
      limit: String(opts.limit ?? 50),
    }
  );

  return data.data.map((c) => ({
    ...c,
    insights: c.insights?.data?.[0] ?? null,
  }));
}

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const data = await metaGet<{ data: MetaAdSet[] }>(`${campaignId}/adsets`, {
    fields: "id,name,campaign_id,status,daily_budget,lifetime_budget,optimization_goal",
  });
  return data.data;
}

export async function listAds(adSetId: string): Promise<MetaAd[]> {
  const data = await metaGet<{ data: MetaAd[] }>(`${adSetId}/ads`, {
    fields: "id,name,adset_id,campaign_id,status,effective_status",
  });
  return data.data;
}

export async function getInsights(objectId: string, datePreset = "last_30d"): Promise<MetaInsights | null> {
  const data = await metaGet<{ data: MetaInsights[] }>(`${objectId}/insights`, {
    fields: INSIGHTS_FIELDS,
    date_preset: datePreset,
  });
  return data.data[0] ?? null;
}

/**
 * Changes a campaign's status (pause/resume). Real budget impact —
 * callers (API routes, UI) are responsible for requiring explicit user
 * confirmation before calling this; it is never exposed as an
 * autonomous agent tool (see lib/agents/tools.ts).
 */
export async function setCampaignStatus(campaignId: string, status: MetaCampaignStatus): Promise<{ success: boolean }> {
  return metaPost(campaignId, { status });
}

export interface CreateCampaignInput {
  name: string;
  objective: string;
  status?: "ACTIVE" | "PAUSED";
  special_ad_categories?: string[];
}

/** Creates a campaign — real spend impact once ad sets/ads/budget are attached. Confirm before calling. */
export async function createCampaign(input: CreateCampaignInput): Promise<{ id: string }> {
  const accountId = env.META_AD_ACCOUNT_ID!;
  return metaPost(`${accountId}/campaigns`, {
    name: input.name,
    objective: input.objective,
    status: input.status ?? "PAUSED",
    special_ad_categories: JSON.stringify(input.special_ad_categories ?? []),
  });
}

export interface UpdateCampaignInput {
  name?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

/** Updates campaign fields (name/budget). Confirm before calling — real spend impact. */
export async function updateCampaign(campaignId: string, input: UpdateCampaignInput): Promise<{ success: boolean }> {
  const params: Record<string, string> = {};
  if (input.name) params.name = input.name;
  if (input.daily_budget) params.daily_budget = input.daily_budget;
  if (input.lifetime_budget) params.lifetime_budget = input.lifetime_budget;
  return metaPost(campaignId, params);
}
