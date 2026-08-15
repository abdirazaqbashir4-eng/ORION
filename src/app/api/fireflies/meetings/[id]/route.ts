import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getMeeting, FirefliesError } from "@/lib/fireflies/client";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!features.meetings) {
    return NextResponse.json(
      { error: "Meetings are not configured. Set FIREFLIES_API_KEY." },
      { status: 503 }
    );
  }

  const { id } = await params;

  try {
    const meeting = await getMeeting(id);
    return NextResponse.json({ meeting });
  } catch (err) {
    const status = err instanceof FirefliesError ? 502 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load meeting." },
      { status }
    );
  }
}
