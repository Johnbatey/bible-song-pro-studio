export const STT_SAMPLE_RATE = 16000;

/**
 * Runs on the audio thread. Buffers the 128-frame render quanta into ~64ms chunks
 * before posting, so the main thread and IPC see ~15 messages/sec rather than 375.
 * Delivered as a Blob URL to avoid shipping a separate worklet asset.
 */
const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 1024;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset === this.chunkSize) {
        const out = this.buffer.slice(0);
        this.port.postMessage(out, [out.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('bsp-capture', CaptureProcessor);
`;

export interface AudioCaptureHandle {
  stop: () => void;
  context: AudioContext;
}

export interface AudioCaptureOptions {
  deviceId?: string;
  /** 16 kHz mono float frames, ~64ms each. */
  onAudio: (frames: Float32Array) => void;
  /** 0..1 RMS-ish level for the meter. */
  onLevel?: (level: number) => void;
  onError?: (error: Error) => void;
}

function floatToPcm16(frames: Float32Array): Int16Array {
  const pcm = new Int16Array(frames.length);
  for (let i = 0; i < frames.length; i++) {
    const clamped = Math.max(-1, Math.min(1, frames[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

export function toPcm16Buffer(frames: Float32Array): ArrayBuffer {
  return floatToPcm16(frames).buffer as ArrayBuffer;
}

/**
 * Opens the microphone and streams 16 kHz mono audio.
 *
 * The AudioContext is requested at 16 kHz directly so the browser's resampler does the
 * downsampling — hand-rolled decimation without a low-pass filter aliases badly and
 * measurably hurts recognition accuracy.
 */
export async function startAudioCapture(options: AudioCaptureOptions): Promise<AudioCaptureHandle> {
  const constraints: MediaStreamConstraints = {
    audio: options.deviceId
      ? {
          deviceId: { exact: options.deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        }
      : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Fallback to basic audio constraints if exact constraints fail
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  const context = new AudioContext({ sampleRate: STT_SAMPLE_RATE });

  // Some browsers ignore the requested rate; warn rather than silently sending
  // audio at the wrong rate, which Deepgram would transcribe as gibberish.
  if (context.sampleRate !== STT_SAMPLE_RATE) {
    console.warn(`AudioContext running at ${context.sampleRate}Hz, expected ${STT_SAMPLE_RATE}Hz`);
  }

  const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await context.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'bsp-capture');

  node.port.onmessage = (event) => {
    const frames = event.data as Float32Array;
    options.onAudio(frames);
    if (options.onLevel) {
      let sum = 0;
      for (let i = 0; i < frames.length; i++) sum += frames[i] * frames[i];
      options.onLevel(Math.min(1, Math.sqrt(sum / frames.length) * 3));
    }
  };

  source.connect(node);
  // Worklets need a downstream connection to be pulled; a zero-gain sink keeps the
  // graph running without routing the mic to the speakers.
  const sink = context.createGain();
  sink.gain.value = 0;
  node.connect(sink);
  sink.connect(context.destination);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    node.port.onmessage = null;
    try { source.disconnect(); node.disconnect(); sink.disconnect(); } catch { /* already torn down */ }
    stream.getTracks().forEach((track) => track.stop());
    context.close().catch(() => {});
  };

  return { stop, context };
}
