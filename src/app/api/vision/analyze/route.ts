import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getVisionProvider } from "@/lib/vision";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { saveMemory } from "@/lib/memory/store";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const frameSchema = z.object({
  source: z.enum(["camera", "screen"]),
  data: z.string().min(1),
  mediaType: z.literal("image/jpeg"),
  capturedAt: z.number(),
});

const requestSchema = z.object({
  frames: z.array(frameSchema).min(1).max(4),
  transcript: z.string().max(4000).optional(),
  conversationId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  if (!features.ai) {
    return NextResponse.json(
      { error: "Live Vision needs Claude configured. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "vision-analyze"), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { frames, transcript } = parsed.data;

  try {
    const provider = getVisionProvider();
    const result = await provider.analyze({ frames, transcript, conversationId: parsed.data.conversationId });

    if (features.embeddings && user) {
      const summary = transcript
        ? `Live Vision — user asked: "${transcript}" — ORION saw: ${result.reply}`
        : `Live Vision observation: ${result.reply}`;
      saveMemory(user.id, { type: "conversation", content: summary, source: "live-vision" }).catch((err) =>
        logger.error("vision.memory_save_failed", { error: err instanceof Error ? err.message : String(err) })
      );
    }

    return NextResponse.json({ reply: result.reply });
  } catch (err) {
    logger.error("vision.analyze.route_error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Vision analysis failed." }, { status: 502 });
  }
}
