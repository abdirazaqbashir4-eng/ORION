"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWakeWordEngine, WakeWordSetupError, type WakeWordEngine } from "@/lib/wake-word";
import { useContinuousSpeech, type RecognizedUtterance } from "@/hooks/use-continuous-speech";

export type WakeWordAssistantStatus =
  | "disabled"
  | "starting"
  | "standby"
  | "greeting"
  | "listening"
  | "processing"
  | "error";

const GREETING_TEXT = "At your service. How can I help?";
const WAKE_COOLDOWN_MS = 3000;

/**
 * Orchestrates ORION's wake-word standby loop:
 *
 *   disabled -> standby (on-device wake engine only, nothing leaves the
 *   device) -> [wake phrase detected] -> greeting (ElevenLabs TTS,
 *   "At your service. How can I help?") -> listening (Azure continuous,
 *   auto-language-detecting recognition) -> processing (utterance
 *   captured) -> back to standby.
 *
 * Deliberately does NOT call /api/chat or any Claude endpoint — per the
 * current phase, the captured utterance + detected language are only
 * surfaced for standalone testing (see components/voice/wake-word-panel.tsx).
 * Wiring the AI brain onto `lastUtterance` is future work.
 *
 * The microphone is never opened until `enable()` is called, which only
 * ever happens from an explicit user click (see the enable toggle in the
 * panel) — never automatically on mount.
 */
export function useWakeWordAssistant() {
  const [status, setStatus] = useState<WakeWordAssistantStatus>("disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUtterance, setLastUtterance] = useState<RecognizedUtterance | null>(null);
  const [wakeCount, setWakeCount] = useState(0);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const engineRef = useRef<WakeWordEngine | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef<WakeWordAssistantStatus>("disabled");
  const enterStandbyRef = useRef<() => Promise<void>>(async () => {});
  const handleWakeRef = useRef<(label: string) => Promise<void>>(async () => {});
  const continuousSpeech = useContinuousSpeech();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopEverything = useCallback(async () => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    continuousSpeech.stop();
    if (engineRef.current) {
      const engine = engineRef.current;
      engineRef.current = null;
      await engine.stop();
    }
  }, [continuousSpeech]);

  const enterStandby = useCallback(async () => {
    try {
      if (engineRef.current) {
        const previous = engineRef.current;
        engineRef.current = null;
        await previous.stop();
      }

      const engine = createWakeWordEngine({ cooldownMs: WAKE_COOLDOWN_MS });
      engineRef.current = engine;

      const { keywordLabel } = await engine.start({
        onWake: (label) => void handleWakeRef.current(label),
        onError: (err) => {
          setErrorMessage(err.message);
          setStatus("error");
        },
      });

      setActiveKeyword(keywordLabel);
      setErrorMessage(null);
      setStatus("standby");
    } catch (err) {
      const message =
        err instanceof WakeWordSetupError
          ? err.message
          : err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone access was denied. Allow microphone access in your OS/browser settings and try again."
            : err instanceof Error
              ? err.message
              : "Failed to start wake-word listening.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, []);

  const handleWake = useCallback(
    async (label: string) => {
      if (engineRef.current) {
        const engine = engineRef.current;
        engineRef.current = null;
        await engine.stop();
      }

      setWakeCount((n) => n + 1);
      setLastUtterance(null);
      setErrorMessage(null);
      setStatus("greeting");

      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: GREETING_TEXT }),
        });
        if (!res.ok) throw new Error("Failed to speak the wake greeting.");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audioEl = new Audio(url);
        audioElRef.current = audioEl;

        await new Promise<void>((resolve, reject) => {
          audioEl.onended = () => resolve();
          audioEl.onerror = () => reject(new Error("Greeting playback failed."));
          audioEl.play().catch(reject);
        });
      } catch (err) {
        // Non-fatal: a broken greeting shouldn't stop ORION from listening —
        // just log it in-panel and continue into the recognition step.
        setErrorMessage(err instanceof Error ? err.message : "Greeting playback failed.");
      }

      if (statusRef.current === "disabled") return; // disabled mid-greeting
      setStatus("listening");

      await continuousSpeech.start(
        (utterance) => {
          setLastUtterance(utterance);
          setStatus("processing");
          continuousSpeech.stop();
          window.setTimeout(() => {
            if (statusRef.current !== "disabled") void enterStandbyRef.current();
          }, 1200);
        },
        () => {
          // Recognition session ended on its own (silence timeout, network
          // drop, etc.) without ever capturing an utterance — return to
          // standby rather than leaving the mic in limbo.
          if (statusRef.current === "listening") void enterStandbyRef.current();
        }
      );

      void label; // reserved for a future per-keyword wake log
    },
    [continuousSpeech]
  );

  useEffect(() => {
    enterStandbyRef.current = enterStandby;
  }, [enterStandby]);

  useEffect(() => {
    handleWakeRef.current = handleWake;
  }, [handleWake]);

  const enable = useCallback(async () => {
    setStatus("starting");
    await enterStandbyRef.current();
  }, []);

  const disable = useCallback(async () => {
    await stopEverything();
    setStatus("disabled");
    setErrorMessage(null);
    setActiveKeyword(null);
  }, [stopEverything]);

  /** Aborts the current greeting/listening turn (e.g. a false-positive wake) back to standby, without disabling. */
  const cancel = useCallback(() => {
    audioElRef.current?.pause();
    continuousSpeech.stop();
    if (statusRef.current !== "disabled") void enterStandbyRef.current();
  }, [continuousSpeech]);

  useEffect(() => {
    return () => {
      void stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, errorMessage, lastUtterance, wakeCount, activeKeyword, enable, disable, cancel };
}
