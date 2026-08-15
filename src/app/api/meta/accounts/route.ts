import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { listAdAccounts, MetaApiError } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function GET() {
  if (!features.metaAds) {
    return NextResponse.json(
      { error: "Meta Ads is not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID." },
      { status: 503 }
    );
  }

  try {
    const accounts = await listAdAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    const status = err instanceof MetaApiError ? 502 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load ad accounts." }, { status });
  }
}
