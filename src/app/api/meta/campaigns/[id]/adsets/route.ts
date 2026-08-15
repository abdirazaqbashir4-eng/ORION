import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { listAdSets, MetaApiError } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!features.metaAds) {
    return NextResponse.json({ error: "Meta Ads is not configured." }, { status: 503 });
  }

  const { id } = await params;

  try {
    const adSets = await listAdSets(id);
    return NextResponse.json({ adSets });
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load ad sets." }, { status });
  }
}
