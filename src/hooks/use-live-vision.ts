"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechActivityDetector } from "@/lib/voice/vad";
import type { VisionMode, VisionSource } from "@/lib/vision/types";

export type LiveVisionState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface CapturedFrame {
  source: VisionSource;
  data: string;
  mediaType: "image/jpeg";
  capturedAt: number;
}

/**
 * Live Vision: camera and/or screen capture, sampled on-demand (not
 * continuously) whenever the user speaks, so a frame only ever leaves
 * the device attached to something the user actually asked about —
 * matching the "process frames only as needed" privacy requirement.
 * Nothing is recorded or persisted client-side; frames are captured,
 * sent for analysis, and discarded.
 */
export function useLiveVision() {
  const [mode, setModeState] = useState<VisionMode>("off");
  const [state, setState] = useState<LiveVisionState>("idle");
  const [transcript, setTranscript] = useState("");
  const [replyText, setReplyText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const conversationId = useRef<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const vadRef = useRef<SpeechActivityDetector | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const modeRef = useRef<VisionMode>("off");
  const startListeningRef = useRef<() => void>(() => {});

  const stopPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
  }, []);

  const attachPreview = useCallback((source: VisionSource, stream: MediaStream) => {
    const videoRef = source === "camera" ? cameraVideoRef : screenVideoRef;
    if (!videoRef.current) {
      videoRef.current = document.createElement("video");
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
    }
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => {});
  }, []);

  const stopSource = useCallback((source: VisionSource) => {
    const streamRef = source === "camera" ? cameraStreamRef : screenStreamRef;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const videoRef = source === "camera" ? cameraVideoRef : screenVideoRef;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (source === "camera") setCameraStream(null);
    else setScreenStream(null);
  }, []);

  const releaseMic = useCallback(() => {
    vadRef.current?.stop();
    vadRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    recorderRef.current = null;
  }, []);

  /** Grabs one JPEG frame from a live <video> element via an offscreen canvas. */
  function grabFrame(source: VisionSource): CapturedFrame | null {
    const videoRef = source === "camera" ? cameraVideoRef : screenVideoRef;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const data = dataUrl.split(",")[1] ?? "";
    return { source, data, mediaType: "image/jpeg", capturedAt: Date.now() };
  }

  const setMode = useCallback(
    async (next: VisionMode) => {
      setErrorMessage(null);
      const wasOff = modeRef.current === "off";
      const wantsCamera = next === "camera" || next === "both";
      const wantsScreen = next === "screen" || next === "both";

      try {
        if (wantsCamera && !cameraStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540 } });
          cameraStreamRef.current = stream;
          setCameraStream(stream);
          attachPreview("camera", stream);
        } else if (!wantsCamera) {
          stopSource("camera");
        }

        if (wantsScreen && !screenStreamRef.current) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = stream;
          setScreenStream(stream);
          attachPreview("screen", stream);
          // If the user stops sharing via the OS/browser's own share-bar
          // control, reflect that immediately instead of a silent stuck state.
          stream.getVideoTracks()[0]?.addEventListener("ended", () => {
            stopSource("screen");
            setModeState((current) => (current === "screen" ? "off" : current === "both" ? "camera" : current));
          });
        } else if (!wantsScreen) {
          stopSource("screen");
        }

        setModeState(next);
        modeRef.current = next;
        if (next === "off") {
          stopSource("camera");
          stopSource("screen");
          releaseMic();
          stopPlayback();
          setState("idle");
        } else if (wasOff) {
          startListeningRef.current();
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Permission denied.");
        setState("error");
      }
    },
    [attachPreview, releaseMic, stopPlayback, stopSource]
  );

  /** Emergency stop — releases every capture source immediately, regardless of state. */
  const stopAll = useCallback(() => {
    stopSource("camera");
    stopSource("screen");
    releaseMic();
    stopPlayback();
    setModeState("off");
    modeRef.current = "off";
    setState("idle");
  }, [releaseMic, stopPlayback, stopSource]);

  const runTurn = useCallback(async (audioBlob: Blob) => {
    setState("thinking");
    setErrorMessage(null);

    try {
      const form = new FormData();
      form.append("audio", audioBlob, "speech.webm");
      const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      if (!transcribeRes.ok) throw new Error("Transcription failed");
      const { text } = (await transcribeRes.json()) as { text: string };
      if (!text?.trim()) {
        setState("idle");
        return;
      }
      setTranscript(text);

      const frames = [grabFrame("camera"), grabFrame("screen")].filter((f): f is CapturedFrame => f !== null);
      if (frames.length === 0) throw new Error("No active vision source to capture a frame from.");

      const analyzeRes = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, transcript: text, conversationId: conversationId.current }),
      });
      if (!analyzeRes.ok) throw new Error("Vision analysis failed");
      const { reply } = (await analyzeRes.json()) as { reply: string };
      setReplyText(reply);

      setState("speaking");
      const speakRes = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (!speakRes.ok) throw new Error("Text-to-speech failed");

      const audioBlobOut = await speakRes.blob();
      const url = URL.createObjectURL(audioBlobOut);
      const audioEl = new Audio(url);
      audioEl.onended = () => {
        // Re-arm for the next turn automatically, as long as the user
        // hasn't hit STOP or switched vision off while ORION was talking.
        if (modeRef.current !== "off") {
          startListeningRef.current();
        } else {
          setState("idle");
        }
      };
      audioElRef.current = audioEl;
      await audioEl.play();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Live Vision turn failed");
      setState("error");
    }
  }, []);

  const startListening = useCallback(async () => {
    stopPlayback();
    setTranscript("");
    setReplyText("");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        vadRef.current?.stop();
        vadRef.current = null;
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        if (blob.size < 1000) {
          setState("listening");
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
  }, [runTurn, stopPlayback]);

  useEffect(() => {
    startListeningRef.current = () => void startListening();
  }, [startListening]);

  return {
    mode,
    state,
    transcript,
    replyText,
    errorMessage,
    cameraStream,
    screenStream,
    setMode,
    startListening,
    stopAll,
  };
}
