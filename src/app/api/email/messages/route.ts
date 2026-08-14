import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isGmailConnected } from "@/lib/google/oauth";
import { listRecentEmails } from "@/lib/google/gmail";
import { classifyEmails } from "@/lib/ai/email";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!features.email) {
    return NextResponse.json({ error: "Gmail is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!(await isGmailConnected(user.id))) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? undefined;

  const emails = await listRecentEmails(user.id, { query, maxResults: 20 });
  const classifications = features.ai ? await classifyEmails(emails) : {};

  return NextResponse.json({
    connected: true,
    emails: emails.map((e) => ({ ...e, ...classifications[e.id] })),
  });
}
