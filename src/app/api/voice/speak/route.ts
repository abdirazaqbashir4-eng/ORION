import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";
import { getVoiceProvider, VoiceProviderError } from "@/lib/voice/tts";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  /** BCP-47 tag or bare code (e.g. "so-SO", "ar", "en-US") — routes to Azure for so/ar, ElevenLabs otherwise. */
  language: z.string().optional(),
});

export async function POST(req: Request) {
  if (!features.voiceTts && !features.voiceMultilingual) {
    return NextResponse.json(
      {
        error:
          "Text-to-speech is not configured. Set ELEVENLABS_API_KEY (English) and/or AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (Somali/Arabic).",
      },
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
  const { text, voiceId, language } = parsed.data;

  try {
    const provider = getVoiceProvider(language);
    const audioStream = await provider.synthesizeSpeechStream({ text, voiceId });

    return new Response(audioStream, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof VoiceProviderError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    logger.error("voice.speak.unexpected_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Text-to-speech failed unexpectedly." }, { status: 500 });
  }
}
