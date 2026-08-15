export interface WakeWordCallbacks {
  /** Fired the moment the wake phrase is detected. `label` identifies which keyword matched. */
  onWake: (label: string) => void;
  onError: (error: Error) => void;
}

/**
 * Provider-agnostic on-device wake-word contract. Swapping engines (e.g. an
 * Azure custom-keyword model later) means adding a class that implements
 * this interface and returning it from `./index.ts` — nothing outside
 * `lib/wake-word` needs to change.
 */
export interface WakeWordEngine {
  readonly name: string;
  /** Starts standby listening. Resolves once the engine is actively listening. */
  start(callbacks: WakeWordCallbacks): Promise<{ keywordLabel: string }>;
  /** Stops listening and releases the microphone/worker. */
  stop(): Promise<void>;
}

/** Thrown when required on-device assets (model/keyword files) aren't in place yet. */
export class WakeWordSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WakeWordSetupError";
  }
}
