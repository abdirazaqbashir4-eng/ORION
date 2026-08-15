"use client";

import { useCallback, useRef, useState } from "react";
import { SpeechActivityDetector } from "@/lib/voice/vad";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

/**
 * Orchestrates the full voice loop: mic -> VAD-gated recording -> Whisper
 * transcription -> the same /api/chat pipeline used by text chat (so
 * conversation persistence and memory retrieval, Phases 3/5/6, apply
 * identically to voice) -> ElevenLabs TTS -> playback, with barge-in
 * (speaking again, or reopening the panel, cuts off current playback).
 */
export function useVoiceAssistant() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [replyText, setReplyText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversationId = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const vadRef = useRef<SpeechActivityDetector | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
  }, []);

  const releaseMic = useCallback(() => {
    vadRef.current?.stop();
    vadRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const runTurn = useCallback(async (blob: Blob) => {
    setState("thinking");
    setErrorMessage(null);

    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      if (!transcribeRes.ok) throw new Error("Transcription failed");
      const { text } = (await transcribeRes.json()) as { text: string };
      if (!text?.trim()) {
        setState("idle");
        return;
      }
      setTranscript(text);

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId.current, message: text }),
      });
      if (!chatRes.ok || !chatRes.body) throw new Error("Chat request failed");

      const newConversationId = chatRes.headers.get("X-Conversation-Id");
      if (newConversationId) conversationId.current = newConversationId;

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullReply += decoder.decode(value, { stream: true });
        setReplyText(fullReply);
      }

      setState("speaking");
      const speakRes = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullReply }),
      });
      if (!speakRes.ok) throw new Error("Text-to-speech failed");

      const audioBlob = await speakRes.blob();
      const url = URL.createObjectURL(audioBlob);
      const audioEl = new Audio(url);
      audioEl.onended = () => setState("idle");
      audioElRef.current = audioEl;
      await audioEl.play();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Voice pipeline failed");
      setState("error");
    }
  }, []);

  const startListening = useCallback(async () => {
    stopPlayback(); // barge-in: talking again interrupts ORION mid-reply
    setTranscript("");
    setReplyText("");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        releaseMic();
        if (blob.size < 1000) {
          setState("idle");
          return;
        }
        void runTurn(blob);
      };
      recorder.start();
      setState("listening");

      const vad = new SpeechActivityDetector(stream, {
        silenceDurationMs: 1100,
        onSpeechEnd: () => {
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        },
      });
      vadRef.current = vad;
      vad.start();
    } catch {
      setErrorMessage("Microphone access was denied.");
      setState("error");
    }
  }, [releaseMic, runTurn, stopPlayback]);

  const stopListening = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      releaseMic();
      setState("idle");
    }
  }, [releaseMic]);

  const reset = useCallback(() => {
    stopPlayback();
    releaseMic();
    setState("idle");
    setTranscript("");
    setReplyText("");
    setErrorMessage(null);
  }, [releaseMic, stopPlayback]);

  return { state, transcript, replyText, errorMessage, startListening, stopListening, reset };
}
