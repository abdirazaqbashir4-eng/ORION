import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDueAutomations } from "@/lib/automations/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueAutomations();
  return NextResponse.json(result);
}

// Vercel Cron sends GET requests by default.
export async function GET(req: Request) {
  return POST(req);
}
