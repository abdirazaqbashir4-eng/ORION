// Runs on the audio render thread (not the main thread) — accumulates raw
// mic samples into 1280-sample (80ms @ 16kHz) blocks and posts each one to
// the main thread, matching openWakeWord's expected streaming chunk size
// (see OpenWakeWordEngine.CHUNK_SAMPLES). Buffering here rather than
// posting every 128-sample render quantum keeps postMessage traffic to
// ~12.5/sec instead of ~125/sec.
class OrionCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this.buffer.push(channel[i]);
      while (this.buffer.length >= 1280) {
        this.port.postMessage(new Float32Array(this.buffer.splice(0, 1280)));
      }
    }
    // Output stays silent (untouched output array) — this node is only
    // connected to destination to keep the audio graph actively pulling
    // frames; ORION never echoes the microphone back out.
    return true;
  }
}

registerProcessor("orion-capture-processor", OrionCaptureProcessor);
