import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listMeetings, FirefliesError } from "@/lib/fireflies/client";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!features.meetings) {
    return NextResponse.json(
      { error: "Meetings are not configured. Set FIREFLIES_API_KEY." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "fireflies-list"), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const url = new URL(req.url);
  const title = url.searchParams.get("q") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 20);

  try {
    const meetings = await listMeetings({ title, limit });
    return NextResponse.json({ meetings });
  } catch (err) {
    const status = err instanceof FirefliesError ? 502 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load meetings." },
      { status }
    );
  }
}
