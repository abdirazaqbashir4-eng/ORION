import { NextResponse } from "next/server";
import { features, env } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Mints a short-lived (10-minute) Azure Speech token so the renderer can
 * drive the Speech SDK's continuous recognizer directly, without ever
 * seeing AZURE_SPEECH_KEY. This is Azure's own recommended browser
 * architecture: the subscription key stays server-only; only the
 * time-boxed token reaches the client (see src/hooks/use-continuous-speech.ts).
 */
export async function GET(req: Request) {
  if (!features.voiceMultilingual) {
    return NextResponse.json(
      { error: "Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "voice-azure-token"), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const res = await fetch(
      `https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      { method: "POST", headers: { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY! } }
    );

    if (!res.ok) {
      throw new Error(`Azure token endpoint responded ${res.status}`);
    }

    const token = await res.text();
    return NextResponse.json({ token, region: env.AZURE_SPEECH_REGION });
  } catch (err) {
    logger.error("voice.azure_token.failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to mint Azure Speech token." }, { status: 502 });
  }
}
