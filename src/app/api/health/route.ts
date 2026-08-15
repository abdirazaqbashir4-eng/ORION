import { NextResponse } from "next/server";
import { features } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    integrations: features,
  });
}
