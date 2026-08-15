import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { getMeeting, FirefliesError } from "@/lib/fireflies/client";
import { syncMeetingToMemory } from "@/lib/fireflies/memory-sync";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!features.meetings || !features.embeddings || !features.database) {
    return NextResponse.json(
      { error: "Meetings, embeddings, and the database must all be configured." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const meeting = await getMeeting(id);
    const memory = await syncMeetingToMemory(user.id, meeting);
    return NextResponse.json({ memory });
  } catch (err) {
    const status = err instanceof FirefliesError ? 502 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save meeting to memory." },
      { status }
    );
  }
}
