"use client";

import { useCallback, useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

/** Candidate languages Azure picks between on each utterance — English, Somali, Arabic. */
const CANDIDATE_LANGUAGES = ["en-US", "so-SO", "ar-SA"];

export interface RecognizedUtterance {
  text: string;
  /** BCP-47 locale Azure detected for this utterance, e.g. "so-SO". */
  language: string;
}

/**
 * Continuous, auto-language-detecting speech recognition via the Azure
 * Speech SDK. Used after a wake-word fires (see use-wake-word-assistant.ts)
 * — this is deliberately separate from the existing Whisper-based
 * tap-to-talk flow in use-voice-assistant.ts, which keeps working
 * unchanged for the manual mic button.
 *
 * The subscription key never reaches this module: it exchanges a
 * short-lived token from /api/voice/azure-token (server-only) and hands
 * that to the SDK, per Azure's own recommended browser architecture.
 */
export function useContinuousSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  const stop = useCallback(() => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    setIsListening(false);
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => recognizer.close(),
        () => recognizer.close()
      );
    }
  }, []);

  const start = useCallback(
    async (onUtterance: (utterance: RecognizedUtterance) => void, onEnded?: () => void) => {
      setError(null);

      try {
        const tokenRes = await fetch("/api/voice/azure-token");
        const tokenData = (await tokenRes.json()) as { token?: string; region?: string; error?: string };
        if (!tokenRes.ok || tokenData.error || !tokenData.token || !tokenData.region) {
          throw new Error(tokenData.error ?? "Failed to obtain a speech token.");
        }

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(tokenData.token, tokenData.region);
        const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(CANDIDATE_LANGUAGES);
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig);
        recognizerRef.current = recognizer;

        recognizer.recognized = (_sender, e) => {
          if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
            const detected = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);
            onUtterance({ text: e.result.text, language: detected.language || "en-US" });
          }
        };

        recognizer.canceled = (_sender, e) => {
          if (e.reason === SpeechSDK.CancellationReason.Error) {
            setError(e.errorDetails || "Speech recognition error.");
          }
          stop();
          onEnded?.();
        };

        recognizer.sessionStopped = () => {
          stop();
          onEnded?.();
        };

        await new Promise<void>((resolve, reject) => {
          recognizer.startContinuousRecognitionAsync(
            () => resolve(),
            (err) => reject(new Error(err))
          );
        });

        setIsListening(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start speech recognition.");
        setIsListening(false);
      }
    },
    [stop]
  );

  return { start, stop, isListening, error };
}
