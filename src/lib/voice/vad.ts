"use client";

interface VadOptions {
  /** RMS (0-1) above which audio is considered speech. */
  volumeThreshold?: number;
  /** How long the signal must stay below the threshold before speech is considered over. */
  silenceDurationMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

/** Lightweight energy-based voice activity detector over a live mic stream. */
export class SpeechActivityDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private rafId: number | null = null;
  private speaking = false;
  private silenceStartedAt: number | null = null;
  private readonly opts: Required<VadOptions>;

  constructor(stream: MediaStream, opts: VadOptions = {}) {
    this.opts = {
      volumeThreshold: opts.volumeThreshold ?? 0.02,
      silenceDurationMs: opts.silenceDurationMs ?? 900,
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
    };

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.fftSize);
  }

  start() {
    const tick = () => {
      this.analyser.getByteTimeDomainData(this.dataArray);

      let sumSquares = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const normalized = (this.dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / this.dataArray.length);

      if (rms > this.opts.volumeThreshold) {
        this.silenceStartedAt = null;
        if (!this.speaking) {
          this.speaking = true;
          this.opts.onSpeechStart();
        }
      } else if (this.speaking) {
        if (this.silenceStartedAt === null) {
          this.silenceStartedAt = performance.now();
        } else if (performance.now() - this.silenceStartedAt > this.opts.silenceDurationMs) {
          this.speaking = false;
          this.silenceStartedAt = null;
          this.opts.onSpeechEnd();
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.source.disconnect();
    void this.audioContext.close();
  }
}
