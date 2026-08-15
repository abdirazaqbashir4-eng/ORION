"use client";

import * as ort from "onnxruntime-web/wasm";
import type { WakeWordCallbacks, WakeWordEngine } from "./types";
import { WakeWordSetupError } from "./types";

// Self-hosted WASM runtime (copied from node_modules/onnxruntime-web/dist
// at build time — see package.json "postinstall") so inference never
// depends on a CDN. Single-threaded: avoids requiring the COOP/COEP
// cross-origin-isolation headers SharedArrayBuffer needs, which keeps
// deployment simple — these models are tiny enough (~3.5MB total) that
// single-threaded WASM comfortably finishes each 80ms chunk in time.
ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1;

const MODEL_DIR = "/wake-word/openwakeword";
const WORKLET_URL = `${MODEL_DIR}/capture-worklet.js`;
const WORKLET_NAME = "orion-capture-processor";

// A pretrained, known-working openWakeWord keyword — see .env.example for
// why this replaced Picovoice. Swapping in a custom-trained "Hey ORION"
// model later means dropping its .onnx file in MODEL_DIR and changing
// these two constants — nothing else in this file changes.
const CLASSIFIER_FILE = "hey_jarvis_v0.1.onnx";
const KEYWORD_LABEL = "hey jarvis";

// --- Constants below are openWakeWord's own streaming pipeline
// parameters, confirmed against the reference Python implementation
// (openwakeword/utils.py's AudioFeatures class) so this port's detection
// behavior matches the original as closely as possible. Do not change
// these without re-checking that source.
const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1280; // 80ms @ 16kHz — one streaming step
const LOOKBACK_SAMPLES = 160 * 3; // extra raw-audio context per melspectrogram call, for correct STFT edge framing
const MEL_BINS = 32;
const MEL_WINDOW = 76; // mel frames consumed per embedding
const MEL_MAX_LEN = 10 * 97; // ~10s of mel-frame history retained
const FEATURE_DIM = 96;
const FEATURE_WINDOW = 16; // embeddings consumed per classifier call
const FEATURE_MAX_LEN = 120; // ~10s of embedding history retained
const INT16_SCALE = 32768; // browser mic samples are float32 [-1,1]; the model expects raw 16-bit PCM magnitude

async function publicFileExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * On-device (WebAssembly, ONNX Runtime) wake-word detection via
 * openWakeWord — no account, API key, or cloud service, unlike Picovoice.
 * Runs melspectrogram -> embedding -> classifier, chained exactly as
 * openWakeWord's Python streaming implementation does, entirely in the
 * renderer. Audio never leaves the machine.
 */
export class OpenWakeWordEngine implements WakeWordEngine {
  readonly name = "openwakeword";

  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private melSession: ort.InferenceSession | null = null;
  private embSession: ort.InferenceSession | null = null;
  private clsSession: ort.InferenceSession | null = null;

  private rawBuffer: number[] = [];
  private pendingSamples: number[] = [];
  private melBuffer: Float32Array[] = [];
  private featureBuffer: Float32Array[] = [];
  private cooldownUntil = 0;
  private running = false;

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number
  ) {}

  async start({ onWake, onError }: WakeWordCallbacks): Promise<{ keywordLabel: string }> {
    for (const file of ["melspectrogram.onnx", "embedding_model.onnx", CLASSIFIER_FILE]) {
      if (!(await publicFileExists(`${MODEL_DIR}/${file}`))) {
        throw new WakeWordSetupError(`openWakeWord model file missing: public${MODEL_DIR}/${file}`);
      }
    }

    this.melSession = await ort.InferenceSession.create(`${MODEL_DIR}/melspectrogram.onnx`);
    this.embSession = await ort.InferenceSession.create(`${MODEL_DIR}/embedding_model.onnx`);
    this.clsSession = await ort.InferenceSession.create(`${MODEL_DIR}/${CLASSIFIER_FILE}`);

    this.rawBuffer = [];
    this.pendingSamples = [];
    // openWakeWord seeds this buffer with 76 frames of 1.0 so the very
    // first embedding call has a full-size window to consume immediately.
    this.melBuffer = Array.from({ length: MEL_WINDOW }, () => new Float32Array(MEL_BINS).fill(1));
    this.featureBuffer = [];
    this.cooldownUntil = 0;

    // Mic is only opened here, inside start() — start() is only ever
    // called from the user's explicit "Enable" action (see
    // use-wake-word-assistant.ts), never automatically.
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule(WORKLET_URL);

    const source = this.audioContext.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, WORKLET_NAME);
    this.running = true;

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!this.running) return;
      this.enqueueBlock(event.data, onWake, onError);
    };

    source.connect(this.workletNode);
    // Connected to destination only to keep the graph actively pulling
    // frames — the worklet's output is left silent, so nothing is heard.
    this.workletNode.connect(this.audioContext.destination);

    return { keywordLabel: KEYWORD_LABEL };
  }

  private enqueueBlock(block: Float32Array, onWake: (label: string) => void, onError: (error: Error) => void): void {
    for (let i = 0; i < block.length; i++) {
      this.pendingSamples.push(block[i] * INT16_SCALE);
    }

    while (this.pendingSamples.length >= CHUNK_SAMPLES && this.running) {
      const chunk = this.pendingSamples.splice(0, CHUNK_SAMPLES);
      this.processChunk(chunk, onWake).catch((err) => {
        onError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }

  private async processChunk(chunk: number[], onWake: (label: string) => void): Promise<void> {
    this.rawBuffer.push(...chunk);
    const maxRaw = SAMPLE_RATE * 10;
    if (this.rawBuffer.length > maxRaw) this.rawBuffer.splice(0, this.rawBuffer.length - maxRaw);

    // 1) Melspectrogram over the new chunk plus a small look-back window
    //    for correct STFT edge framing (mirrors openWakeWord's
    //    _streaming_melspectrogram).
    const lookback = Math.min(this.rawBuffer.length, CHUNK_SAMPLES + LOOKBACK_SAMPLES);
    const melInput = Float32Array.from(this.rawBuffer.slice(-lookback));
    const melResult = await this.melSession!.run({
      input: new ort.Tensor("float32", melInput, [1, melInput.length]),
    });
    const melOut = melResult[this.melSession!.outputNames[0]];
    const frameCount = melOut.dims[melOut.dims.length - 2] as number;
    const melData = melOut.data as Float32Array;

    // openWakeWord's own post-processing transform, applied after the ONNX
    // call ("makes the ONNX melspectrogram model closer to the native
    // TensorFlow one" — per the reference implementation).
    for (let f = 0; f < frameCount; f++) {
      const frame = new Float32Array(MEL_BINS);
      for (let b = 0; b < MEL_BINS; b++) frame[b] = melData[f * MEL_BINS + b] / 10 + 2;
      this.melBuffer.push(frame);
    }
    if (this.melBuffer.length > MEL_MAX_LEN) this.melBuffer.splice(0, this.melBuffer.length - MEL_MAX_LEN);

    // 2) One new embedding from the trailing 76-frame mel window.
    if (this.melBuffer.length >= MEL_WINDOW) {
      const window = this.melBuffer.slice(-MEL_WINDOW);
      const embInput = new Float32Array(MEL_WINDOW * MEL_BINS);
      for (let f = 0; f < MEL_WINDOW; f++) embInput.set(window[f], f * MEL_BINS);

      const embResult = await this.embSession!.run({
        input_1: new ort.Tensor("float32", embInput, [1, MEL_WINDOW, MEL_BINS, 1]),
      });
      const embOut = embResult[this.embSession!.outputNames[0]];
      this.featureBuffer.push(Float32Array.from(embOut.data as Float32Array).slice(0, FEATURE_DIM));
      if (this.featureBuffer.length > FEATURE_MAX_LEN) {
        this.featureBuffer.splice(0, this.featureBuffer.length - FEATURE_MAX_LEN);
      }
    }

    // 3) Classify the trailing 16-embedding window.
    if (this.featureBuffer.length >= FEATURE_WINDOW) {
      const window = this.featureBuffer.slice(-FEATURE_WINDOW);
      const clsInput = new Float32Array(FEATURE_WINDOW * FEATURE_DIM);
      for (let i = 0; i < FEATURE_WINDOW; i++) clsInput.set(window[i], i * FEATURE_DIM);

      const clsResult = await this.clsSession!.run({
        "x.1": new ort.Tensor("float32", clsInput, [1, FEATURE_WINDOW, FEATURE_DIM]),
      });
      const score = (clsResult[this.clsSession!.outputNames[0]].data as Float32Array)[0];

      const now = Date.now();
      if (score >= this.threshold && now >= this.cooldownUntil) {
        this.cooldownUntil = now + this.cooldownMs;
        onWake(KEYWORD_LABEL);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.melSession = null;
    this.embSession = null;
    this.clsSession = null;
    this.rawBuffer = [];
    this.pendingSamples = [];
    this.melBuffer = [];
    this.featureBuffer = [];
  }
}
