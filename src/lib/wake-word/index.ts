"use client";

import { OpenWakeWordEngine } from "./openwakeword-engine";
import type { WakeWordEngine } from "./types";

export type { WakeWordCallbacks, WakeWordEngine } from "./types";
export { WakeWordSetupError } from "./types";

// openWakeWord runs entirely on-device with bundled model files — unlike
// Picovoice, there's no account or key gate, so this is always true. Kept
// as an exported flag (rather than deleted) so callers that check
// "is wake word available" don't need to change if that ever stops being
// unconditional (e.g. a future engine that does need configuration).
export const wakeWordConfigured = true;

/**
 * Returns ORION's configured wake-word engine. This is the only place that
 * decides *which* engine is active — the orchestration hook depends only on
 * the `WakeWordEngine` interface, so swapping in a custom-trained "Hey
 * ORION" model (or a different engine entirely) later is a change confined
 * to this file and openwakeword-engine.ts.
 */
export function createWakeWordEngine(options?: { threshold?: number; cooldownMs?: number }): WakeWordEngine {
  return new OpenWakeWordEngine(options?.threshold ?? 0.5, options?.cooldownMs ?? 3000);
}
