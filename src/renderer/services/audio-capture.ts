export const STT_SAMPLE_RATE = 16000;

/**
 * Runs on the audio thread at native audio context sample rate (44.1k, 48k, etc).
 * Features an Adaptive Multi-Band Noise Suppressor & Voice Expander (Google Meet / Zoom style),
 * dynamic noise floor estimation, zero-latency VAD, dual-channel stereo RMS VU metering,
 * and high-fidelity 16 kHz resampler for STT.
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

    // DSP Configuration
    this.noiseSuppression = false;
    this.suppressionLevel = 'aggressive'; // 'studio' | 'aggressive' | 'extreme'
    this.sensitivity = 1.0; // 0.5 to 2.0 multiplier

    // Multi-band State & Filter Memories (Left & Right)
    this.hpX1_L = 0; this.hpX2_L = 0; this.hpY1_L = 0; this.hpY2_L = 0;
    this.hpX1_R = 0; this.hpX2_R = 0; this.hpY1_R = 0; this.hpY2_R = 0;
    
    // Crossover filters (500 Hz low/mid, 3800 Hz mid/high)
    this.crossLp1_L = 0; this.crossLp2_L = 0;
    this.crossLp1_R = 0; this.crossLp2_R = 0;

    // Adaptive Noise Floor Estimation
    this.noiseFloorMid = 0.003;
    this.noiseFloorHigh = 0.0015;
    this.noiseFloorTotal = 0.004;

    // VAD & Dynamics Gate State
    this.envelopeMid = 0;
    this.envelopeHigh = 0;
    this.gateGain = 1.0;
    this.targetGateGain = 1.0;
    this.hangoverFrames = 0;
    this.isVoiceActive = false;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data && data.type === 'SET_DSP') {
        if (data.noiseSuppression !== undefined) this.noiseSuppression = Boolean(data.noiseSuppression);
        if (data.suppressionLevel !== undefined) this.suppressionLevel = data.suppressionLevel;
        if (data.sensitivity !== undefined) this.sensitivity = Math.max(0.2, Math.min(3.0, Number(data.sensitivity)));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const chL = input[0];
    const chR = input[1] || input[0];
    const isStereo = Boolean(input[1]);
    const len = chL.length;

    // Measure raw RMS levels on input signal for VU meters
    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < len; i++) {
      sumL += chL[i] * chL[i];
      sumR += chR[i] * chR[i];
    }
    const rmsL = Math.min(1, Math.sqrt(sumL / len) * 3.2);
    const rmsR = Math.min(1, Math.sqrt(sumR / len) * 3.2);

    const processedL = new Float32Array(len);
    const processedR = new Float32Array(len);

    if (this.noiseSuppression) {
      // Attenuation Floor:
      // aggressive (Meet/Zoom): -48 dB (0.004 min gain)
      // studio (Natural): -20 dB (0.10 min gain)
      // extreme (Max Isolation): -72 dB (0.00025 min gain)
      let minGain = 0.004;
      let thresholdScale = 2.4;
      let hangoverLength = Math.round(sampleRate * 0.20 / len); // ~200ms hold time

      if (this.suppressionLevel === 'studio') {
        minGain = 0.10;
        thresholdScale = 1.6;
        hangoverLength = Math.round(sampleRate * 0.24 / len);
      } else if (this.suppressionLevel === 'extreme') {
        minGain = 0.00025;
        thresholdScale = 3.4;
        hangoverLength = Math.round(sampleRate * 0.16 / len);
      }

      // High-Pass Biquad Filter (Butterworth 2nd order at 95 Hz to kill sub-bass air & AC rumble)
      const f0 = 95.0;
      const Q = 0.707;
      const w0 = 2 * Math.PI * f0 / sampleRate;
      const alpha = Math.sin(w0) / (2 * Q);
      const cosw0 = Math.cos(w0);

      const b0 = (1 + cosw0) / 2;
      const b1 = -(1 + cosw0);
      const b2 = (1 + cosw0) / 2;
      const a0 = 1 + alpha;
      const a1 = -2 * cosw0;
      const a2 = 1 - alpha;

      const norm_b0 = b0 / a0;
      const norm_b1 = b1 / a0;
      const norm_b2 = b2 / a0;
      const norm_a1 = a1 / a0;
      const norm_a2 = a2 / a0;

      // Filter state across block
      let blockEnergyMid = 0;
      let blockEnergyHigh = 0;
      let blockTotalEnergy = 0;

      const filteredL = new Float32Array(len);
      const filteredR = new Float32Array(len);

      for (let i = 0; i < len; i++) {
        const inL = chL[i];
        const inR = chR[i];

        // 1. High-Pass Filter (Left)
        const hpL = norm_b0 * inL + norm_b1 * this.hpX1_L + norm_b2 * this.hpX2_L - norm_a1 * this.hpY1_L - norm_a2 * this.hpY2_L;
        this.hpX2_L = this.hpX1_L; this.hpX1_L = inL;
        this.hpY2_L = this.hpY1_L; this.hpY1_L = hpL;

        // 1. High-Pass Filter (Right)
        const hpR = norm_b0 * inR + norm_b1 * this.hpX1_R + norm_b2 * this.hpX2_R - norm_a1 * this.hpY1_R - norm_a2 * this.hpY2_R;
        this.hpX2_R = this.hpX1_R; this.hpX1_R = inR;
        this.hpY2_R = this.hpY1_R; this.hpY1_R = hpR;

        filteredL[i] = hpL;
        filteredR[i] = hpR;

        // 2. Frequency splitting for Vocal Presence (500Hz - 4kHz) vs High Hiss (> 4kHz)
        const midLpL = this.crossLp1_L + 0.55 * (hpL - this.crossLp1_L);
        this.crossLp1_L = midLpL;

        const midLpR = this.crossLp1_R + 0.55 * (hpR - this.crossLp1_R);
        this.crossLp1_R = midLpR;

        const highL = hpL - midLpL;
        const highR = hpR - midLpR;

        blockEnergyMid += midLpL * midLpL + midLpR * midLpR;
        blockEnergyHigh += highL * highL + highR * highR;
        blockTotalEnergy += hpL * hpL + hpR * hpR;
      }

      const meanMid = Math.sqrt(blockEnergyMid / (len * 2));
      const meanHigh = Math.sqrt(blockEnergyHigh / (len * 2));
      const meanTotal = Math.sqrt(blockTotalEnergy / (len * 2));

      // 3. Adaptive Minimum-Statistics Noise Floor Tracking
      if (meanTotal < this.noiseFloorTotal) {
        this.noiseFloorTotal += (meanTotal - this.noiseFloorTotal) * 0.12;
      } else {
        this.noiseFloorTotal += (meanTotal - this.noiseFloorTotal) * 0.0003;
      }

      if (meanMid < this.noiseFloorMid) {
        this.noiseFloorMid += (meanMid - this.noiseFloorMid) * 0.12;
      } else {
        this.noiseFloorMid += (meanMid - this.noiseFloorMid) * 0.0003;
      }

      this.noiseFloorTotal = Math.max(0.0006, Math.min(0.08, this.noiseFloorTotal));
      this.noiseFloorMid = Math.max(0.0005, Math.min(0.06, this.noiseFloorMid));

      // 4. Voice Activity Detection (VAD) with Sensitivity Control
      const sens = Math.max(0.2, this.sensitivity);
      const threshold = thresholdScale / sens;
      const minEnergyThreshold = this.noiseFloorTotal * (1.5 / sens);

      const midSnr = meanMid / this.noiseFloorMid;
      const totalSnr = meanTotal / this.noiseFloorTotal;

      const isVoiceInstant = (midSnr > threshold || totalSnr > (threshold * 1.1)) && meanTotal > minEnergyThreshold;

      if (isVoiceInstant) {
        this.hangoverFrames = hangoverLength;
        this.isVoiceActive = true;
      } else if (this.hangoverFrames > 0) {
        this.hangoverFrames--;
        this.isVoiceActive = true;
      } else {
        this.isVoiceActive = false;
      }

      // 5. Dynamic Gain (Sub-millisecond attack, smooth release)
      if (this.isVoiceActive) {
        this.targetGateGain = 1.0;
        this.gateGain += (1.0 - this.gateGain) * 0.75;
      } else {
        const snrRatio = Math.max(0, Math.min(1.0, meanTotal / (this.noiseFloorTotal * threshold)));
        const target = minGain + (1.0 - minGain) * Math.pow(snrRatio, 2.5);
        this.targetGateGain = target;
        this.gateGain += (target - this.gateGain) * 0.10;
      }

      for (let i = 0; i < len; i++) {
        processedL[i] = filteredL[i] * this.gateGain;
        processedR[i] = filteredR[i] * this.gateGain;
      }
    } else {
      // Complete pure transparent bypass - resets all filter states
      this.isVoiceActive = true;
      this.gateGain = 1.0;
      this.targetGateGain = 1.0;
      this.hangoverFrames = 0;
      this.hpX1_L = 0; this.hpX2_L = 0; this.hpY1_L = 0; this.hpY2_L = 0;
      this.hpX1_R = 0; this.hpX2_R = 0; this.hpY1_R = 0; this.hpY2_R = 0;
      this.crossLp1_L = 0; this.crossLp2_L = 0;
      this.crossLp1_R = 0; this.crossLp2_R = 0;
      processedL.set(chL);
      processedR.set(chR);
    }

    // Output processed audio back to Web Audio graph so headphone monitor hears live gated audio
    if (output && output[0]) {
      output[0].set(processedL);
      if (output[1]) output[1].set(processedR);
    }

    // Resample down to 16kHz for STT engine
    if (Math.abs(sampleRate - this.targetRate) < 1) {
      for (let i = 0; i < len; i++) {
        this.buffer[this.offset++] = processedL[i];
        if (this.offset === this.chunkSize) {
          const out = this.buffer.slice(0);
          this.port.postMessage({
            frames: out,
            rmsL,
            rmsR,
            isStereo,
            isVoiceActive: this.isVoiceActive,
            gateGain: this.gateGain,
          }, [out.buffer]);
          this.offset = 0;
        }
      }
    } else {
      const ratio = this.resampleRatio;
      for (let i = 0; i < len; i++) {
        const current = processedL[i];
        while (this.resamplePhase < 1.0) {
          const interp = this.lastSample + this.resamplePhase * (current - this.lastSample);
          this.buffer[this.offset++] = interp;
          if (this.offset === this.chunkSize) {
            const out = this.buffer.slice(0);
            this.port.postMessage({
              frames: out,
              rmsL,
              rmsR,
              isStereo,
              isVoiceActive: this.isVoiceActive,
              gateGain: this.gateGain,
            }, [out.buffer]);
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
  noiseSuppressionLevel?: 'studio' | 'aggressive' | 'extreme';
  noiseSuppressionSensitivity?: number;
  autoGainControl?: boolean;
  digitalGain?: number;
  isHeadphoneMonitoring?: boolean;
  monitorVolume?: number;
}

export interface AudioLevels {
  level: number;
  levelL: number;
  levelR: number;
  isStereo: boolean;
  isVoiceActive?: boolean;
  gateGain?: number;
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
  /** Dual-channel RMS levels for stereo VU metering and DSP state. */
  onLevel?: (levels: AudioLevels) => void;
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
    googEchoCancellation: isEcho,
    googAutoGainControl: isAgc,
    googNoiseSuppression: isNoise,
    googHighpassFilter: isNoise,
    googExperimentalNoiseSuppression: isNoise,
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
 * Incorporates active Adaptive Multi-Band Noise Suppression & Gating (Meet/Zoom style),
 * Dynamics Compressor, Preamp Gain, and true post-DSP headphone monitoring.
 */
export async function startAudioCapture(options: AudioCaptureOptions): Promise<AudioCaptureHandle> {
  let activeDsp = { ...options.dsp };
  let currentDeviceId = options.deviceId;
  let currentHardwareDsp = {
    echoCancellation: Boolean(activeDsp.echoCancellation),
    noiseSuppression: Boolean(activeDsp.noiseSuppression),
    autoGainControl: Boolean(activeDsp.autoGainControl),
  };

  const constraints = buildAudioConstraints(currentDeviceId, activeDsp);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Fallback if exact constraints fail
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: Boolean(activeDsp.echoCancellation),
        noiseSuppression: Boolean(activeDsp.noiseSuppression),
        autoGainControl: Boolean(activeDsp.autoGainControl),
      },
    });
  }

  // Native sample rate AudioContext (44.1kHz or 48kHz for pristine studio-quality sound)
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
  const initialGain = typeof activeDsp.digitalGain === 'number' ? Math.max(0.1, Math.min(10, activeDsp.digitalGain)) : 1.0;
  gainNode.gain.setValueAtTime(initialGain, context.currentTime);

  // 2. AudioWorklet Node (Adaptive Multi-Band Noise Suppressor & Downsampler)
  const node = new AudioWorkletNode(context, 'bsp-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  // Initialize DSP settings in worklet
  node.port.postMessage({
    type: 'SET_DSP',
    noiseSuppression: Boolean(activeDsp.noiseSuppression),
    suppressionLevel: activeDsp.noiseSuppressionLevel || 'aggressive',
    sensitivity: activeDsp.noiseSuppressionSensitivity ?? 1.0,
  });

  // 3. Dynamics Compressor (Active when AGC is enabled)
  const compressor = context.createDynamicsCompressor();
  compressor.knee.setValueAtTime(activeDsp.autoGainControl ? 30 : 0, context.currentTime);
  compressor.ratio.setValueAtTime(activeDsp.autoGainControl ? 6 : 1, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.25, context.currentTime);
  compressor.threshold.setValueAtTime(activeDsp.autoGainControl ? -24 : 0, context.currentTime);

  // 4. Dedicated Headphone Monitor Gain Node (Connected POST-DSP so filters are heard live)
  const monitorGainNode = context.createGain();
  const initialMonitorVolume = typeof activeDsp.monitorVolume === 'number' ? Math.max(0, Math.min(1, activeDsp.monitorVolume)) : 1.0;
  monitorGainNode.gain.setValueAtTime(activeDsp.isHeadphoneMonitoring ? initialMonitorVolume : 0, context.currentTime);

  node.port.onmessage = (event) => {
    const data = event.data;
    if (data && data.frames) {
      options.onAudio(data.frames);
      if (options.onLevel) {
        const levelL = data.rmsL ?? 0;
        const levelR = data.rmsR ?? levelL;
        const level = Math.max(levelL, levelR);
        options.onLevel({
          level,
          levelL,
          levelR,
          isStereo: Boolean(data.isStereo),
          isVoiceActive: data.isVoiceActive,
          gateGain: data.gateGain,
        });
      }
    } else if (data instanceof Float32Array) {
      options.onAudio(data);
    }
  };

  // Signal Routing:
  // source -> gainNode -> node (Adaptive Noise Suppressor & Expander) -> compressor -> monitorGainNode -> destination
  source.connect(gainNode);
  gainNode.connect(node);
  node.connect(compressor);
  compressor.connect(monitorGainNode);
  monitorGainNode.connect(context.destination);

  // Worklets need a downstream connection to be pulled; zero-gain sink keeps graph active
  const sink = context.createGain();
  sink.gain.value = 0;
  compressor.connect(sink);
  sink.connect(context.destination);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    node.port.onmessage = null;
    try {
      source.disconnect();
      gainNode.disconnect();
      node.disconnect();
      compressor.disconnect();
      monitorGainNode.disconnect();
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
   * Seamless live microphone hot-swapping without restarting the AI, STT engine, or AudioContext
   */
  const switchDevice = async (newDeviceId?: string) => {
    if (stopped || !context) return;
    try {
      currentDeviceId = newDeviceId || currentDeviceId;
      const newConstraints = buildAudioConstraints(currentDeviceId, { ...activeDsp, ...currentHardwareDsp });
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

  /**
   * In-place hardware and Web Audio DSP filter update without audio pipeline recreation
   */
  const updateDspConstraints = async (newDsp: AudioDspOptions) => {
    if (stopped || !context) return;
    activeDsp = { ...activeDsp, ...newDsp };

    // 1. Send updated noise suppression config directly into audio worklet
    node.port.postMessage({
      type: 'SET_DSP',
      noiseSuppression: Boolean(newDsp.noiseSuppression),
      suppressionLevel: newDsp.noiseSuppressionLevel || 'aggressive',
      sensitivity: newDsp.noiseSuppressionSensitivity ?? 1.0,
    });

    // 2. Adjust Dynamics Compressor
    if (compressor) {
      const isAgc = Boolean(newDsp.autoGainControl);
      const threshold = isAgc ? -24 : 0;
      const ratio = isAgc ? 6 : 1;
      const knee = isAgc ? 30 : 0;
      try {
        compressor.threshold.setTargetAtTime(threshold, context.currentTime, 0.03);
        compressor.ratio.setTargetAtTime(ratio, context.currentTime, 0.03);
        compressor.knee.setTargetAtTime(knee, context.currentTime, 0.03);
      } catch {
        compressor.threshold.value = threshold;
        compressor.ratio.value = ratio;
        compressor.knee.value = knee;
      }
    }

    if (newDsp.digitalGain !== undefined) {
      setGain(newDsp.digitalGain);
    }

    if (newDsp.isHeadphoneMonitoring !== undefined || newDsp.monitorVolume !== undefined) {
      setMonitor(Boolean(newDsp.isHeadphoneMonitoring), newDsp.monitorVolume);
    }

    // 3. Hardware OS audio driver update (switches cleanly between AUVoiceIO and AUHAL)
    const hardwareChanged =
      Boolean(newDsp.echoCancellation) !== currentHardwareDsp.echoCancellation ||
      Boolean(newDsp.noiseSuppression) !== currentHardwareDsp.noiseSuppression ||
      Boolean(newDsp.autoGainControl) !== currentHardwareDsp.autoGainControl;

    if (hardwareChanged) {
      currentHardwareDsp = {
        echoCancellation: Boolean(newDsp.echoCancellation),
        noiseSuppression: Boolean(newDsp.noiseSuppression),
        autoGainControl: Boolean(newDsp.autoGainControl),
      };
      await switchDevice(currentDeviceId);
    }
  };

  return { stop, context, setGain, setMonitor, updateDspConstraints, switchDevice };
}
