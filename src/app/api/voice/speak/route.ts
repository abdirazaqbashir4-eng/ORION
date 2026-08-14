import { NextResponse } from "next/server";
import { z } from "zod";
import { env, features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
});

export async function POST(req: Request) {
  if (!features.voiceTts) {
    return NextResponse.json(
      { error: "Text-to-speech is not configured. Set ELEVENLABS_API_KEY." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "voice-speak"), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { text, voiceId } = parsed.data;

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? env.ELEVENLABS_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.8 },
      }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `ElevenLabs request failed (${upstream.status})`, detail },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
