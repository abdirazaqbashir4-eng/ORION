import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "@/lib/env";

export function getAnthropicClient() {
  if (!features.ai) {
    throw new Error("Claude API is not configured. Set ANTHROPIC_API_KEY.");
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export const CHAT_MODEL = env.ANTHROPIC_MODEL;
