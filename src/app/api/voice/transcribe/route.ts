import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env, features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!features.voiceStt) {
    return NextResponse.json(
      { error: "Speech-to-text is not configured. Set OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "voice-transcribe"), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const formData = await req.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const transcription = await client.audio.transcriptions.create({
    file: audio,
    model: env.WHISPER_MODEL,
  });

  return NextResponse.json({ text: transcription.text });
}
