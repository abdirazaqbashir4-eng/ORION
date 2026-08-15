import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listCampaignsWithInsights, createCampaign, MetaApiError } from "@/lib/meta/client";
import { toCampaignMetrics, compareCampaigns, identifyUnderperforming } from "@/lib/meta/analysis";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!features.metaAds) {
    return NextResponse.json(
      { error: "Meta Ads is not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const datePreset = url.searchParams.get("date_preset") ?? "last_30d";

  try {
    const campaigns = await listCampaignsWithInsights({ datePreset });
    const metrics = toCampaignMetrics(campaigns);
    const compared = compareCampaigns(metrics);
    const underperforming = identifyUnderperforming(metrics);

    return NextResponse.json({ campaigns, metrics: compared, underperforming });
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load campaigns." }, { status });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().min(1),
  confirm: z.boolean(),
});

/**
 * Creates a campaign — real (if unpaused) spend impact. Requires an
 * explicit `confirm: true` in the request body; the UI must have shown
 * the user a confirmation step before ever sending this. Always created
 * PAUSED regardless of input, so nothing spends without a second,
 * separate explicit resume action.
 */
export async function POST(req: Request) {
  if (!features.metaAds) {
    return NextResponse.json({ error: "Meta Ads is not configured." }, { status: 503 });
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "meta-create-campaign"), {
    limit: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.confirm) {
    return NextResponse.json({ error: "Explicit confirmation is required to create a campaign." }, { status: 400 });
  }

  try {
    const result = await createCampaign({ name: parsed.data.name, objective: parsed.data.objective, status: "PAUSED" });
    await logAuditEvent(user?.id ?? null, "meta_campaign_created", { campaignId: result.id, name: parsed.data.name });
    return NextResponse.json({ campaign: result });
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create campaign." }, { status });
  }
}
