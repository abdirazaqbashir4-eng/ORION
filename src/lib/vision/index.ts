import "server-only";
import { features } from "@/lib/env";
import { ClaudeVisionProvider } from "./claude-vision-provider";
import type { VisionProvider } from "./types";

export type { AnalyzeVisionInput, AnalyzeVisionResult, VisionFrame, VisionMode, VisionProvider } from "./types";

let cachedProvider: VisionProvider | null = null;

/** The single seam for swapping vision providers later (see lib/voice/tts for the same pattern). */
export function getVisionProvider(): VisionProvider {
  if (!features.ai) {
    throw new Error("Live Vision needs Claude configured. Set ANTHROPIC_API_KEY.");
  }
  if (!cachedProvider) {
    cachedProvider = new ClaudeVisionProvider();
  }
  return cachedProvider;
}
