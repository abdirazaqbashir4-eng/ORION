import "server-only";
import { env, features } from "@/lib/env";
import { ElevenLabsVoiceProvider } from "./elevenlabs-provider";
import { AzureVoiceProvider } from "./azure-provider";
import type { VoiceProvider } from "./types";

export type { SynthesizeSpeechOptions, VoiceProvider } from "./types";
export { VoiceProviderError } from "./types";

let cachedElevenLabs: VoiceProvider | null = null;
let cachedAzure: VoiceProvider | null = null;

function elevenLabsProvider(): VoiceProvider {
  if (!features.voiceTts) {
    throw new Error("Text-to-speech is not configured. Set ELEVENLABS_API_KEY.");
  }
  if (!cachedElevenLabs) {
    cachedElevenLabs = new ElevenLabsVoiceProvider({
      apiKey: env.ELEVENLABS_API_KEY!,
      defaultVoiceId: env.ELEVENLABS_VOICE_ID,
      modelId: env.ELEVENLABS_MODEL,
    });
  }
  return cachedElevenLabs;
}

function azureProvider(defaultVoiceId: string): VoiceProvider {
  if (!features.voiceMultilingual) {
    throw new Error("Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.");
  }
  if (!cachedAzure) {
    cachedAzure = new AzureVoiceProvider({
      subscriptionKey: env.AZURE_SPEECH_KEY!,
      region: env.AZURE_SPEECH_REGION!,
      defaultVoiceId,
    });
  }
  return cachedAzure;
}

/**
 * Returns ORION's configured text-to-speech provider for a given language.
 * This is the only place that decides *which* provider handles which
 * language — API routes and other callers depend only on the
 * `VoiceProvider` interface, so adding a provider or remapping a language
 * later is a change confined to this file.
 *
 * `language` accepts a BCP-47 tag (e.g. "so-SO", "ar-SA", "en-US") or a
 * bare language code ("so", "ar", "en"). Defaults to ElevenLabs/English
 * when omitted or unrecognized, preserving the pre-multilingual behavior.
 */
export function getVoiceProvider(language?: string): VoiceProvider {
  const lang = language?.split("-")[0]?.toLowerCase();

  if (lang === "so") return azureProvider(env.AZURE_SPEECH_VOICE_SOMALI);
  if (lang === "ar") return azureProvider(env.AZURE_SPEECH_VOICE_ARABIC);
  return elevenLabsProvider();
}
