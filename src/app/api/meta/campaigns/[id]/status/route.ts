import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { setCampaignStatus, MetaApiError } from "@/lib/meta/client";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/security/audit";

export const runtime = "nodejs";

const requestSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]),
  confirm: z.boolean(),
});

/**
 * Pauses or resumes a campaign — real spend impact either direction.
 * Requires an explicit `confirm: true` in the body; the UI must show a
 * confirmation dialog before ever sending this request. Every call is
 * audit-logged. Never exposed as an autonomous agent tool — a human
 * initiates this, always (see lib/agents/tools.ts for the read-only
 * equivalent the agents actually get).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!features.metaAds) {
    return NextResponse.json({ error: "Meta Ads is not configured." }, { status: 503 });
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "meta-campaign-status"), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.confirm) {
    return NextResponse.json({ error: "Explicit confirmation is required to change campaign status." }, { status: 400 });
  }

  const { id } = await params;

  try {
    const result = await setCampaignStatus(id, parsed.data.status);
    await logAuditEvent(user?.id ?? null, "meta_campaign_status_changed", { campaignId: id, status: parsed.data.status });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update campaign status." },
      { status }
    );
  }
}
