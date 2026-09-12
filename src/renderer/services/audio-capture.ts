export const STT_SAMPLE_RATE = 16000;

/**
 * Runs on the audio thread at native audio context sample rate (44.1k, 48k, etc).
 * Performs precision linear downsampling to 16 kHz for the speech-to-text pipeline,
 * while leaving the main Web Audio graph and headphone monitor at pristine full broadcast fidelity.
 */
const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.chunkSize = 1024;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
    this.resampleRatio = sampleRate / this.targetRate;
    this.resamplePhase = 0;
    this.lastSample = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Take primary channel directly to prevent destructive mono phase cancellation
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    if (Math.abs(sampleRate - this.targetRate) < 1) {
      // Already 16 kHz
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.offset++] = channel[i];
        if (this.offset === this.chunkSize) {
          const out = this.buffer.slice(0);
          this.port.postMessage(out, [out.buffer]);
          this.offset = 0;
        }
      }
    } else {
      // Precision linear resampler from native hardware rate (44.1k/48k/96k) down to 16kHz
      const ratio = this.resampleRatio;
      for (let i = 0; i < channel.length; i++) {
        const current = channel[i];
        while (this.resamplePhase < 1.0) {
          const interp = this.lastSample + this.resamplePhase * (current - this.lastSample);
          this.buffer[this.offset++] = interp;
          if (this.offset === this.chunkSize) {
            const out = this.buffer.slice(0);
            this.port.postMessage(out, [out.buffer]);
            this.offset = 0;
          }
          this.resamplePhase += ratio;
        }
        this.resamplePhase -= 1.0;
        this.lastSample = current;
      }
    }
    return true;
  }
}
registerProcessor('bsp-capture', CaptureProcessor);
`;

export interface AudioDspOptions {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  digitalGain?: number;
  isHeadphoneMonitoring?: boolean;
  monitorVolume?: number;
}

export interface AudioCaptureHandle {
  stop: () => void;
  context: AudioContext;
  setGain: (gain: number) => void;
  setMonitor: (enabled: boolean, volume?: number) => void;
  updateDspConstraints: (dsp: AudioDspOptions) => Promise<void>;
  switchDevice: (deviceId?: string) => Promise<void>;
}

export interface AudioCaptureOptions {
  deviceId?: string;
  dsp?: AudioDspOptions;
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

function buildAudioConstraints(deviceId?: string, dsp: AudioDspOptions = {}): MediaStreamConstraints {
  const isEcho = Boolean(dsp.echoCancellation);
  const isNoise = Boolean(dsp.noiseSuppression);
  const isAgc = Boolean(dsp.autoGainControl);

  const audioTrackConstraints: any = {
    echoCancellation: isEcho,
    noiseSuppression: isNoise,
    autoGainControl: isAgc,
    // Disable Chromium's internal telephony VoiceProcessing algorithms when user turned them off
    googEchoCancellation: isEcho,
    googAutoGainControl: isAgc,
    googNoiseSuppression: isNoise,
    googHighpassFilter: isNoise,
    googTypingNoiseDetection: isNoise,
    googAudioMirroring: false,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 },
  };

  if (deviceId) {
    audioTrackConstraints.deviceId = { exact: deviceId };
  }

  return { audio: audioTrackConstraints, video: false };
}

/**
 * Opens the microphone and streams audio at native studio broadcast quality.
 * The internal graph runs at full 44.1k/48k resolution, while the AudioWorklet
 * downsamples to 16 kHz specifically for the speech recognizer.
 */
export async function startAudioCapture(options: AudioCaptureOptions): Promise<AudioCaptureHandle> {
  const dsp = options.dsp || {};
  const constraints = buildAudioConstraints(options.deviceId, dsp);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Fallback if exact constraints fail
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: Boolean(dsp.echoCancellation),
        noiseSuppression: Boolean(dsp.noiseSuppression),
        autoGainControl: Boolean(dsp.autoGainControl),
      },
    });
  }

  // Native sample rate AudioContext (44.1kHz or 48kHz for pristine, studio-quality sound)
  const context = new AudioContext();

  const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await context.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  let source = context.createMediaStreamSource(stream);

  // 1. Digital Preamp Gain Node (smooth DAW automation)
  const gainNode = context.createGain();
  const initialGain = typeof dsp.digitalGain === 'number' ? Math.max(0.1, Math.min(10, dsp.digitalGain)) : 1.0;
  gainNode.gain.setValueAtTime(initialGain, context.currentTime);

  // 2. High-Pass Filter (Cuts sub-85Hz rumble/hum when Noise Suppression is ON)
  const hpFilter = context.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.setValueAtTime(dsp.noiseSuppression ? 85 : 10, context.currentTime);
  hpFilter.Q.setValueAtTime(0.707, context.currentTime);

  // 3. Dynamics Compressor (Active only when AGC is enabled)
  const compressor = context.createDynamicsCompressor();
  compressor.knee.setValueAtTime(30, context.currentTime);
  compressor.ratio.setValueAtTime(dsp.autoGainControl ? 6 : 1, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.25, context.currentTime);
  compressor.threshold.setValueAtTime(dsp.autoGainControl ? -24 : 0, context.currentTime);

  // 4. Dedicated Headphone Monitor Gain Node (Pristine uncolored direct output)
  const monitorGainNode = context.createGain();
  const initialMonitorVolume = typeof dsp.monitorVolume === 'number' ? Math.max(0, Math.min(1, dsp.monitorVolume)) : 1.0;
  monitorGainNode.gain.setValueAtTime(dsp.isHeadphoneMonitoring ? initialMonitorVolume : 0, context.currentTime);

  // 5. STT Worklet Node
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

  // Connect Audio Processing Graph:
  // source -> gainNode -> hpFilter -> compressor -> node (STT Worklet)
  // source -> gainNode -> monitorGainNode -> destination (Headphone direct monitor at full 48k fidelity)
  source.connect(gainNode);
  gainNode.connect(hpFilter);
  hpFilter.connect(compressor);
  compressor.connect(node);

  gainNode.connect(monitorGainNode);
  monitorGainNode.connect(context.destination);

  // Worklets need a downstream connection to be pulled; a zero-gain sink keeps the
  // worklet graph active even when headphone monitor is muted.
  const sink = context.createGain();
  sink.gain.value = 0;
  node.connect(sink);
  sink.connect(context.destination);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    node.port.onmessage = null;
    try {
      source.disconnect();
      gainNode.disconnect();
      hpFilter.disconnect();
      compressor.disconnect();
      monitorGainNode.disconnect();
      node.disconnect();
      sink.disconnect();
    } catch { /* already torn down */ }
    stream.getTracks().forEach((track) => track.stop());
    context.close().catch(() => {});
  };

  /**
   * Smooth clickless gain change using a 20ms exponential time constant
   */
  const setGain = (newGain: number) => {
    if (stopped || !gainNode || !context) return;
    const clamped = Math.max(0.1, Math.min(10, newGain));
    try {
      gainNode.gain.setTargetAtTime(clamped, context.currentTime, 0.02);
    } catch {
      gainNode.gain.value = clamped;
    }
  };

  /**
   * Smooth clickless monitor toggle or volume adjustment
   */
  const setMonitor = (enabled: boolean, volume = 1.0) => {
    if (stopped || !monitorGainNode || !context) return;
    const targetVolume = enabled ? Math.max(0, Math.min(1, volume)) : 0;
    try {
      monitorGainNode.gain.setTargetAtTime(targetVolume, context.currentTime, 0.02);
    } catch {
      monitorGainNode.gain.value = targetVolume;
    }
  };

  /**
   * In-place hardware and Web Audio DSP filter update without audio pipeline recreation
   */
  const updateDspConstraints = async (newDsp: AudioDspOptions) => {
    if (stopped || !context) return;

    if (hpFilter) {
      const freq = newDsp.noiseSuppression ? 85 : 10;
      try {
        hpFilter.frequency.setTargetAtTime(freq, context.currentTime, 0.03);
      } catch {
        hpFilter.frequency.value = freq;
      }
    }

    if (compressor) {
      const threshold = newDsp.autoGainControl ? -24 : 0;
      const ratio = newDsp.autoGainControl ? 6 : 1;
      try {
        compressor.threshold.setTargetAtTime(threshold, context.currentTime, 0.03);
        compressor.ratio.setTargetAtTime(ratio, context.currentTime, 0.03);
      } catch {
        compressor.threshold.value = threshold;
        compressor.ratio.value = ratio;
      }
    }

    if (newDsp.digitalGain !== undefined) {
      setGain(newDsp.digitalGain);
    }

    if (newDsp.isHeadphoneMonitoring !== undefined || newDsp.monitorVolume !== undefined) {
      setMonitor(Boolean(newDsp.isHeadphoneMonitoring), newDsp.monitorVolume);
    }

    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        try {
          await track.applyConstraints({
            echoCancellation: Boolean(newDsp.echoCancellation),
            noiseSuppression: Boolean(newDsp.noiseSuppression),
            autoGainControl: Boolean(newDsp.autoGainControl),
          });
        } catch (err) {
          console.warn('Track applyConstraints notice:', err);
        }
      }
    }
  };

  /**
   * Seamless live microphone hot-swapping without restarting the AI, STT engine, or AudioContext
   */
  const switchDevice = async (newDeviceId?: string) => {
    if (stopped || !context) return;
    try {
      const newConstraints = buildAudioConstraints(newDeviceId, dsp);
      const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
      const newSource = context.createMediaStreamSource(newStream);

      // Connect new microphone into the active gainNode before tearing down the old source
      newSource.connect(gainNode);

      try {
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
      } catch {}

      stream = newStream;
      source = newSource;
    } catch (err) {
      console.error('Failed to hot-swap audio device:', err);
    }
  };

  return { stop, context, setGain, setMonitor, updateDspConstraints, switchDevice };
}
