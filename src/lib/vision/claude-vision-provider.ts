import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CHAT_MODEL } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { logger } from "@/lib/logger";
import type { AnalyzeVisionInput, AnalyzeVisionResult, VisionProvider } from "./types";

const VISION_PERSONA = `You are ORION's live vision system. You are shown one or more still frames sampled from the user's camera and/or screen, taken moments ago — not a continuous video feed, so describe what's visible rather than claiming to see motion between frames.

Be concise and concrete: name what's on screen or in view, read visible text when it's relevant, and answer whatever the user asked. If nothing useful is visible, say so plainly instead of guessing.`;

/**
 * Frame-sampled vision: each call sends the most recent captured
 * frame(s) as image content blocks in a single Claude request, reusing
 * the exact vision content-block path already used for chat image
 * attachments (Phase 5). This is not a persistent video stream — see
 * README "Live Vision" notes for what a truly continuous provider
 * would need instead.
 */
export class ClaudeVisionProvider implements VisionProvider {
  readonly name = "claude-vision";

  async analyze({ frames, transcript }: AnalyzeVisionInput): Promise<AnalyzeVisionResult> {
    if (frames.length === 0) {
      throw new Error("No frames provided to analyze.");
    }

    const anthropic = getAnthropicClient();

    const content: Anthropic.Messages.ContentBlockParam[] = frames.map((frame) => ({
      type: "image",
      source: { type: "base64", media_type: frame.mediaType, data: frame.data },
    }));
    content.push({
      type: "text",
      text: transcript
        ? `The user just said: "${transcript}". Respond to them using what's visible in the frame(s) above.`
        : "Briefly describe what's visible in the frame(s) above.",
    });

    try {
      const res = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt({ agentPersona: VISION_PERSONA }),
        messages: [{ role: "user", content }],
      });

      const reply = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";
      logger.info("vision.analyze.success", { frameCount: frames.length, hasTranscript: Boolean(transcript) });

      return { reply, conversationId: null };
    } catch (err) {
      logger.error("vision.analyze.failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
