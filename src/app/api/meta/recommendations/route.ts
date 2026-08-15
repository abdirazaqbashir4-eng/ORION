import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listCampaignsWithInsights, MetaApiError } from "@/lib/meta/client";
import { toCampaignMetrics, identifyUnderperforming, generateAdRecommendations } from "@/lib/meta/analysis";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!features.metaAds || !features.ai) {
    return NextResponse.json(
      { error: "Meta Ads and Claude must both be configured to generate recommendations." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "meta-recommendations"), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const campaigns = await listCampaignsWithInsights({ datePreset: "last_30d" });
    const metrics = toCampaignMetrics(campaigns);
    const underperforming = identifyUnderperforming(metrics);
    const recommendations = await generateAdRecommendations(metrics, underperforming);

    return NextResponse.json({ recommendations, underperforming });
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate recommendations." },
      { status }
    );
  }
}
