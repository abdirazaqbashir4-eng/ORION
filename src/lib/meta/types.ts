export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

export type MetaCampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaCampaignStatus;
  effective_status: string;
  objective: string;
  daily_budget: string | null;
  lifetime_budget: string | null;
  created_time: string;
  updated_time: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: MetaCampaignStatus;
  daily_budget: string | null;
  lifetime_budget: string | null;
  optimization_goal: string | null;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status: MetaCampaignStatus;
  effective_status: string;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsights {
  campaign_id?: string;
  campaign_name?: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  frequency: string;
  actions: MetaAction[] | null;
  date_start: string;
  date_stop: string;
}

export interface CampaignWithInsights extends MetaCampaign {
  insights: MetaInsights | null;
}

/** Sums an action array (Meta's per-conversion-type breakdown) for a given action_type prefix. */
export function sumActionValue(actions: MetaAction[] | null | undefined, actionType: string): number {
  if (!actions) return 0;
  return actions
    .filter((a) => a.action_type === actionType)
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}
