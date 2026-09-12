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
    const channel = inputs[0] && inputs[0][0];
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

/**
 * Opens the microphone and streams audio at native studio broadcast quality.
 * The internal graph runs at full 44.1k/48k resolution, while the AudioWorklet
 * downsamples to 16 kHz specifically for the speech recognizer.
 */
export async function startAudioCapture(options: AudioCaptureOptions): Promise<AudioCaptureHandle> {
  const dsp = options.dsp || {};
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: dsp.echoCancellation ?? false,
    noiseSuppression: dsp.noiseSuppression ?? false,
    autoGainControl: dsp.autoGainControl ?? false,
  };

  if (options.deviceId) {
    audioConstraints.deviceId = { exact: options.deviceId };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
  } catch {
    // Fallback to basic audio constraints if exact device/DSP constraints fail
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: dsp.echoCancellation ?? false,
        noiseSuppression: dsp.noiseSuppression ?? false,
        autoGainControl: dsp.autoGainControl ?? false,
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

  const source = context.createMediaStreamSource(stream);

  // 1. Studio High-Pass Filter (eliminates sub-85Hz mic rumble, stage thumps, HVAC hum)
  const hpFilter = context.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.setValueAtTime(dsp.noiseSuppression ? 85 : 10, context.currentTime);

  // 2. Real-time digital preamp gain node with smooth DAW-style automation
  const gainNode = context.createGain();
  const initialGain = typeof dsp.digitalGain === 'number' ? Math.max(0.1, Math.min(10, dsp.digitalGain)) : 1.0;
  gainNode.gain.setValueAtTime(initialGain, context.currentTime);

  // 3. Studio Broadcast Dynamics Compressor / Auto-Gain Leveler
  const compressor = context.createDynamicsCompressor();
  compressor.knee.setValueAtTime(30, context.currentTime);
  compressor.ratio.setValueAtTime(6, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.25, context.currentTime);
  compressor.threshold.setValueAtTime(dsp.autoGainControl ? -24 : 0, context.currentTime);

  // 4. Dedicated Headphone Monitor Gain Node (Routing to native destination)
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
  // source -> hpFilter -> gainNode -> compressor -> node (STT Worklet)
  //                                  compressor -> monitorGainNode -> destination (Headphones)
  source.connect(hpFilter);
  hpFilter.connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(node);
  compressor.connect(monitorGainNode);
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
      hpFilter.disconnect();
      gainNode.disconnect();
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

    // Update real Web Audio DSP filter nodes smoothly
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
      try {
        compressor.threshold.setTargetAtTime(threshold, context.currentTime, 0.03);
      } catch {
        compressor.threshold.value = threshold;
      }
    }

    if (newDsp.digitalGain !== undefined) {
      setGain(newDsp.digitalGain);
    }

    if (newDsp.isHeadphoneMonitoring !== undefined || newDsp.monitorVolume !== undefined) {
      setMonitor(Boolean(newDsp.isHeadphoneMonitoring), newDsp.monitorVolume);
    }

    // Also update hardware browser track constraints if supported
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        try {
          await track.applyConstraints({
            echoCancellation: newDsp.echoCancellation ?? false,
            noiseSuppression: newDsp.noiseSuppression ?? false,
            autoGainControl: newDsp.autoGainControl ?? false,
          });
        } catch (err) {
          console.warn('Track applyConstraints notice:', err);
        }
      }
    }
  };

  return { stop, context, setGain, setMonitor, updateDspConstraints };
}


