import "server-only";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { logger } from "@/lib/logger";
import type { SynthesizeSpeechOptions, VoiceProvider } from "./types";
import { VoiceProviderError } from "./types";

interface AzureProviderConfig {
  subscriptionKey: string;
  region: string;
  defaultVoiceId: string;
}

/**
 * Wraps the official Azure Cognitive Services Speech SDK for Somali and
 * Arabic TTS (ElevenLabs doesn't cover either language). Implements the
 * same `VoiceProvider` contract as the ElevenLabs provider so
 * `getVoiceProvider()` can dispatch between them by detected language
 * without callers caring which one actually ran.
 *
 * The Node SDK's `speakTextAsync` synthesizes the full clip before
 * resolving (no incremental HTTP streaming in this SDK build) — the result
 * is still wrapped in a `ReadableStream` to satisfy the shared interface,
 * it just arrives as a single chunk rather than progressively like
 * ElevenLabs.
 */
export class AzureVoiceProvider implements VoiceProvider {
  readonly name = "azure";

  constructor(private readonly config: AzureProviderConfig) {}

  async synthesizeSpeechStream({ text, voiceId }: SynthesizeSpeechOptions): Promise<ReadableStream<Uint8Array>> {
    const resolvedVoiceId = voiceId ?? this.config.defaultVoiceId;

    try {
      const audioData = await this.synthesize(text, resolvedVoiceId);

      logger.info("tts.stream.start", {
        provider: this.name,
        voiceId: resolvedVoiceId,
        chars: text.length,
      });

      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(audioData));
          controller.close();
        },
      });
    } catch (err) {
      logger.error("tts.stream.failed", {
        provider: this.name,
        voiceId: resolvedVoiceId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new VoiceProviderError(this.name, err);
    }
  }

  private synthesize(text: string, voiceId: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.config.subscriptionKey, this.config.region);
      speechConfig.speechSynthesisVoiceName = voiceId;
      speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

      // Explicit `undefined` audioConfig: in Node (no `window`) the SDK
      // leaves audio output unset instead of opening a default speaker
      // device, so this only ever returns audio bytes — never plays
      // anything on the server.
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, undefined);

      synthesizer.speakTextAsync(
        text,
        (result) => {
          synthesizer.close();
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error(result.errorDetails || `Azure synthesis failed (reason ${result.reason})`));
          }
        },
        (error) => {
          synthesizer.close();
          reject(new Error(error));
        }
      );
    });
  }
}
