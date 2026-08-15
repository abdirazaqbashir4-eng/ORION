import "server-only";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { logger } from "@/lib/logger";
import type { SynthesizeSpeechOptions, VoiceProvider } from "./types";
import { VoiceProviderError } from "./types";

interface ElevenLabsProviderConfig {
  apiKey: string;
  defaultVoiceId: string;
  modelId: string;
}

/**
 * Wraps the official `@elevenlabs/elevenlabs-js` SDK. The API key is
 * injected by the caller (see `./index.ts`) — this class never reads
 * environment variables directly, so it can't accidentally end up
 * bundled into client code that expects `env.*` to be available.
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = "elevenlabs";
  private readonly client: ElevenLabsClient;
  private readonly defaultVoiceId: string;
  private readonly modelId: string;

  constructor(config: ElevenLabsProviderConfig) {
    this.client = new ElevenLabsClient({ apiKey: config.apiKey });
    this.defaultVoiceId = config.defaultVoiceId;
    this.modelId = config.modelId;
  }

  async synthesizeSpeechStream({ text, voiceId }: SynthesizeSpeechOptions): Promise<ReadableStream<Uint8Array>> {
    const resolvedVoiceId = voiceId ?? this.defaultVoiceId;

    try {
      const stream = await this.client.textToSpeech.stream(resolvedVoiceId, {
        text,
        modelId: this.modelId,
        outputFormat: "mp3_44100_128",
        voiceSettings: { stability: 0.45, similarityBoost: 0.8 },
      });

      logger.info("tts.stream.start", {
        provider: this.name,
        voiceId: resolvedVoiceId,
        model: this.modelId,
        chars: text.length,
      });

      return stream;
    } catch (err) {
      logger.error("tts.stream.failed", {
        provider: this.name,
        voiceId: resolvedVoiceId,
        model: this.modelId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new VoiceProviderError(this.name, err);
    }
  }
}
