export interface SynthesizeSpeechOptions {
  /** Text to speak. */
  text: string;
  /** Overrides the provider's default voice for this call. */
  voiceId?: string;
}

/**
 * Provider-agnostic text-to-speech contract. Swapping providers (e.g.
 * adding Azure or PlayHT later) means adding a new class that implements
 * this interface and registering it in `./index.ts` — nothing outside
 * `lib/voice/tts` needs to change.
 */
export interface VoiceProvider {
  readonly name: string;
  /** Resolves to a live audio stream — callers pipe it straight to the response instead of buffering. */
  synthesizeSpeechStream(options: SynthesizeSpeechOptions): Promise<ReadableStream<Uint8Array>>;
}

export class VoiceProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause: unknown
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`[${provider}] text-to-speech failed: ${detail}`);
    this.name = "VoiceProviderError";
  }
}
