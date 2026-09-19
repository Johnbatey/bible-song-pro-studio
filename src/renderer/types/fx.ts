export type VideoFxType =
  | 'chroma_key'
  | 'color_key'
  | 'lut_3d'
  | 'color_correction'
  | 'crop_pad'
  | 'sharpen'
  | 'blur'
  | 'invert'
  | 'alpha_mask';

export type AudioFxType =
  | 'parametric_eq_8'
  | 'compressor'
  | 'pro_compressor'
  | 'noise_gate'
  | 'expander'
  | 'limiter'
  | 'gain'
  | 'de_esser'
  | 'denoiser'
  | 'pro_denoiser'
  | 'reverb'
  | 'pro_reverb'
  | 'delay'
  | 'chorus'
  | 'flanger'
  | 'phaser'
  | 'tremolo'
  | 'pitch_shifter'
  | 'autotune'
  | 'vocal_doubler'
  | 'tape_saturation'
  | 'distortion'
  | 'transient_shaper'
  | 'stereo_widener'
  | 'stereo_enhancer'
  | 'multiband_compressor'
  | 'highpass'
  | 'lowpass'
  | 'air'
  | 'presence'
  | 'lowshelf'
  | 'ducking'
  | 'vst3_plugin'
  | 'au_plugin';

export interface ChromaKeyParams {
  keyColor: string; // e.g. #00ff00 or #0000ff
  similarity: number; // 1 - 1000
  smoothness: number; // 1 - 1000
  keyColorReduction: number; // Despill: 1 - 1000
  contrast: number; // -100 to 100
  brightness: number; // -100 to 100
  gamma: number; // -100 to 100
  opacity: number; // 0 to 100
}

export interface Lut3dParams {
  lutPath: string;
  lutLabel: string;
  intensity: number; // 0.0 to 1.0 (0% - 100%)
}

export interface ColorCorrectionParams {
  gamma: number; // -3.0 to 3.0 (0 default)
  contrast: number; // -2.0 to 2.0 (0 default)
  brightness: number; // -1.0 to 1.0 (0 default)
  saturation: number; // -1.0 to 5.0 (0 default)
  hueShift: number; // -180 to 180 degrees
  opacity: number; // 0.0 to 1.0
}

export interface CropPadParams {
  top: number; // in pixels
  bottom: number;
  left: number;
  right: number;
  isRelative: boolean; // % vs absolute pixels
}

export interface SharpenParams {
  sharpness: number; // 0.0 to 1.0 (default 0.25, like OBS Studio)
}

export interface ParametricEqBand {
  id: number;
  type: 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass';
  frequency: number; // 20Hz - 20,000Hz
  gainDb: number; // -24 dB to +24 dB
  q: number; // 0.1 to 18.0 (resonance/bandwidth)
  enabled: boolean;
}

export interface ParametricEqParams {
  bands: ParametricEqBand[];
  masterGainDb: number;
}

export interface CompressorParams {
  thresholdDb: number; // -60 dB to 0 dB
  ratio: number; // 1.0 to 30.0 (:1)
  attackMs: number; // 0.1 ms to 100 ms
  releaseMs: number; // 10 ms to 1000 ms
  kneeDb: number; // 0 dB to 12 dB
  makeupGainDb: number; // 0 dB to 30 dB
  sidechainSourceId?: string;
}

export interface NoiseGateParams {
  openThresholdDb: number; // -60 dB to 0 dB
  closeThresholdDb: number; // -60 dB to 0 dB
  attackMs: number; // 1 ms to 50 ms
  holdMs: number; // 0 ms to 500 ms
  releaseMs: number; // 10 ms to 1000 ms
}

export interface LimiterParams {
  thresholdDb: number; // -60 dB to 0 dB
  ceilingDb: number; // -12 dBFS to 0 dBFS (-0.1 default)
  releaseMs: number; // 1 ms to 500 ms
}

export interface VstHostParams {
  pluginPath: string;
  pluginLabel: string;
  pluginFormat: 'vst3' | 'au';
  liveParamValues: Record<string, number>;
  activeSnapshotSlot?: 'A' | 'B';
  snapshotA?: Record<string, number>;
  snapshotB?: Record<string, number>;
}

export interface FxDocument<T = any> {
  id: string;
  type: VideoFxType | AudioFxType;
  category: 'video' | 'audio';
  name: string;
  enabled: boolean;
  bypassed: boolean;
  params: T;
}

export function createDefaultChromaKey(): ChromaKeyParams {
  return {
    keyColor: '#00ff00',
    similarity: 400,
    smoothness: 80,
    keyColorReduction: 100,
    contrast: 0,
    brightness: 0,
    gamma: 0,
    opacity: 100,
  };
}

export function createDefaultColorCorrection(): ColorCorrectionParams {
  return {
    gamma: 0,
    contrast: 0,
    brightness: 0,
    saturation: 0,
    hueShift: 0,
    opacity: 1,
  };
}

export function createDefaultSharpen(): SharpenParams {
  return {
    sharpness: 0.25,
  };
}

export function createDefault8BandEq(): ParametricEqParams {
  return {
    masterGainDb: 0,
    bands: [
      { id: 1, type: 'highpass', frequency: 60, gainDb: 0, q: 0.707, enabled: true },
      { id: 2, type: 'lowshelf', frequency: 120, gainDb: 0, q: 0.707, enabled: true },
      { id: 3, type: 'peaking', frequency: 350, gainDb: 0, q: 1.2, enabled: true },
      { id: 4, type: 'peaking', frequency: 1000, gainDb: 0, q: 1.4, enabled: true },
      { id: 5, type: 'peaking', frequency: 3200, gainDb: 0, q: 1.4, enabled: true },
      { id: 6, type: 'peaking', frequency: 6500, gainDb: 0, q: 1.2, enabled: true },
      { id: 7, type: 'highshelf', frequency: 10000, gainDb: 0, q: 0.707, enabled: true },
      { id: 8, type: 'lowpass', frequency: 18000, gainDb: 0, q: 0.707, enabled: false },
    ],
  };
}

export function createDefaultCompressor(): CompressorParams {
  return {
    thresholdDb: -20,
    ratio: 3.5,
    attackMs: 10,
    releaseMs: 120,
    kneeDb: 3,
    makeupGainDb: 4,
  };
}

export interface GainParams {
  gainDb: number; // -30.0 dB to +30.0 dB (0.0 default)
}

export function createDefaultGain(): GainParams {
  return {
    gainDb: 0.0,
  };
}

export function createDefaultLimiter(): LimiterParams {
  return {
    thresholdDb: -1.0,
    ceilingDb: -0.1,
    releaseMs: 50,
  };
}

export function createDefaultNoiseGate(): NoiseGateParams {
  return {
    openThresholdDb: -38,
    closeThresholdDb: -44,
    attackMs: 5,
    holdMs: 100,
    releaseMs: 150,
  };
}

export interface ProCompressorParams {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  kneeDb: number;
  makeupDb: number;
  mix: number;
}

export function createDefaultProCompressor(): ProCompressorParams {
  return {
    thresholdDb: -24,
    ratio: 3.2,
    attackMs: 3,
    releaseMs: 120,
    kneeDb: 8,
    makeupDb: 2.0,
    mix: 100,
  };
}

export interface DeEsserParams {
  frequency: number; // 3000Hz - 10000Hz
  thresholdDb: number; // -40dB to 0dB
  ratio: number; // 1.0 to 10.0
  attackMs: number;
  releaseMs: number;
}

export function createDefaultDeEsser(): DeEsserParams {
  return {
    frequency: 6000,
    thresholdDb: -20,
    ratio: 4.0,
    attackMs: 1,
    releaseMs: 50,
  };
}

export interface DenoiserParams {
  amount: number; // 0 - 100%
}

export function createDefaultDenoiser(): DenoiserParams {
  return {
    amount: 35,
  };
}

export interface ProDenoiserParams {
  reduction: number; // 0 - 100%
  sensitivity: number; // 0 - 100%
  preserve: number; // 0 - 100%
  attack: number; // 1 - 50ms
  release: number; // 5 - 200ms
  hpf: number; // 20 - 500Hz
  lpf: number; // 4000 - 22000Hz
  dryMix: number; // 0 - 50%
}

export function createDefaultProDenoiser(): ProDenoiserParams {
  return {
    reduction: 65,
    sensitivity: 50,
    preserve: 70,
    attack: 6,
    release: 40,
    hpf: 60,
    lpf: 18000,
    dryMix: 0,
  };
}

export interface ReverbParams {
  mix: number; // 0 - 100%
  decay: number; // 0.1 - 10s
  predelayMs: number; // 0 - 100ms
  size: number; // 0.1 - 1.0
  damping: number; // 1000 - 16000Hz
}

export function createDefaultReverb(): ReverbParams {
  return {
    mix: 20,
    decay: 2.0,
    predelayMs: 15,
    size: 0.6,
    damping: 6000,
  };
}

export interface ProReverbParams {
  mix: number; // 0 - 100%
  decay: number; // 0.3 - 12s
  size: number; // 5 - 100%
  predelayMs: number; // 0 - 120ms
  damping: number; // 800 - 16000Hz
  brightness: number; // 1000 - 18000Hz
  width: number; // 0 - 100%
}

export function createDefaultProReverb(): ProReverbParams {
  return {
    mix: 25,
    decay: 2.5,
    size: 50,
    predelayMs: 20,
    damping: 8000,
    brightness: 8200,
    width: 80,
  };
}

export interface DelayParams {
  timeMs: number; // 1 - 2000ms
  feedback: number; // 0 - 95%
  mix: number; // 0 - 100%
  pingPong: boolean;
}

export function createDefaultDelay(): DelayParams {
  return {
    timeMs: 350,
    feedback: 35,
    mix: 25,
    pingPong: true,
  };
}

export interface ChorusParams {
  rate: number; // 0.1 - 10Hz
  depth: number; // 0 - 100%
  delayMs: number; // 5 - 50ms
  mix: number; // 0 - 100%
}

export function createDefaultChorus(): ChorusParams {
  return {
    rate: 1.2,
    depth: 45,
    delayMs: 18,
    mix: 40,
  };
}

export interface FlangerParams {
  rate: number; // 0.05 - 5Hz
  depth: number; // 0 - 100%
  feedback: number; // 0 - 90%
  mix: number; // 0 - 100%
}

export function createDefaultFlanger(): FlangerParams {
  return {
    rate: 0.5,
    depth: 60,
    feedback: 50,
    mix: 45,
  };
}

export interface PhaserParams {
  rate: number; // 0.05 - 8Hz
  depth: number; // 0 - 100%
  feedback: number; // 0 - 90%
  stages: number; // 2, 4, 8
  mix: number; // 0 - 100%
}

export function createDefaultPhaser(): PhaserParams {
  return {
    rate: 0.8,
    depth: 50,
    feedback: 40,
    stages: 4,
    mix: 40,
  };
}

export interface TremoloParams {
  rate: number; // 0.5 - 20Hz
  depth: number; // 0 - 100%
  shape: 'sine' | 'square' | 'triangle';
}

export function createDefaultTremolo(): TremoloParams {
  return {
    rate: 4.0,
    depth: 60,
    shape: 'sine',
  };
}

export interface PitchShifterParams {
  semitones: number; // -12 to +12
  cents: number; // -100 to +100
  mix: number; // 0 - 100%
}

export function createDefaultPitchShifter(): PitchShifterParams {
  return {
    semitones: 0,
    cents: 0,
    mix: 100,
  };
}

export interface AutotuneParams {
  speed: number; // 0 - 400ms
  humanize: number; // 0 - 100%
  detune: number; // -100 to +100 cents
  mix: number; // 0 - 100%
  flexTune: number; // 0 - 100%
}

export function createDefaultAutotune(): AutotuneParams {
  return {
    speed: 40,
    humanize: 25,
    detune: 0,
    mix: 100,
    flexTune: 20,
  };
}

export interface VocalDoublerParams {
  detune: number; // 0 - 40 cents
  delayMs: number; // 0 - 40ms
  width: number; // 0 - 100%
  mix: number; // 0 - 100%
}

export function createDefaultVocalDoubler(): VocalDoublerParams {
  return {
    detune: 14,
    delayMs: 18,
    width: 80,
    mix: 50,
  };
}

export interface TapeSaturationParams {
  drive: number; // 0 - 60dB
  tone: number; // 0 - 100%
  warmth: number; // 0 - 100%
  mix: number; // 0 - 100%
}

export function createDefaultTapeSaturation(): TapeSaturationParams {
  return {
    drive: 25,
    tone: 55,
    warmth: 40,
    mix: 60,
  };
}

export interface DistortionParams {
  drive: number; // 0 - 100%
  toneHz: number; // 500 - 12000Hz
  mix: number; // 0 - 100%
}

export function createDefaultDistortion(): DistortionParams {
  return {
    drive: 30,
    toneHz: 4500,
    mix: 50,
  };
}

export interface TransientShaperParams {
  attack: number; // -100 to +100%
  sustain: number; // -100 to +100%
  speed: number; // 0 - 100%
  mix: number; // 0 - 100%
}

export function createDefaultTransientShaper(): TransientShaperParams {
  return {
    attack: 30,
    sustain: 0,
    speed: 50,
    mix: 100,
  };
}

export interface StereoWidenerParams {
  width: number; // 0 - 200%
  delayMs: number; // 0 - 30ms (Haas effect)
  mix: number; // 0 - 100%
}

export function createDefaultStereoWidener(): StereoWidenerParams {
  return {
    width: 130,
    delayMs: 8,
    mix: 70,
  };
}

export interface MultibandCompressorParams {
  lowThreshold: number; // -60 to 0dB
  midThreshold: number; // -60 to 0dB
  highThreshold: number; // -60 to 0dB
  lowRatio: number; // 1 - 10
  midRatio: number; // 1 - 10
  highRatio: number; // 1 - 10
  mix: number; // 0 - 100%
}

export function createDefaultMultibandCompressor(): MultibandCompressorParams {
  return {
    lowThreshold: -24,
    midThreshold: -20,
    highThreshold: -18,
    lowRatio: 3.0,
    midRatio: 2.5,
    highRatio: 2.2,
    mix: 100,
  };
}

export interface FilterBoostParams {
  frequency: number; // 20 - 20000Hz
  gainDb: number; // -18 to +18dB
  q: number; // 0.1 - 10
}

export function createDefaultFilterBoost(type: 'highpass' | 'lowpass' | 'air' | 'presence' | 'lowshelf'): FilterBoostParams {
  switch (type) {
    case 'highpass':
      return { frequency: 80, gainDb: 0, q: 0.707 };
    case 'lowpass':
      return { frequency: 16000, gainDb: 0, q: 0.707 };
    case 'air':
      return { frequency: 10000, gainDb: 2.5, q: 0.707 };
    case 'presence':
      return { frequency: 3200, gainDb: 2.2, q: 1.05 };
    case 'lowshelf':
      return { frequency: 160, gainDb: 2.0, q: 0.707 };
  }
}

export interface DuckingParams {
  thresholdDb: number; // -60 to 0dB
  amountDb: number; // 0 to 30dB
  attackMs: number; // 1 to 50ms
  releaseMs: number; // 50 to 1000ms
}

export function createDefaultDucking(): DuckingParams {
  return {
    thresholdDb: -30,
    amountDb: 12,
    attackMs: 10,
    releaseMs: 300,
  };
}

export interface ExpanderParams {
  thresholdDb: number; // -60 to 0dB
  ratio: number; // 1.0 to 10.0
  attackMs: number;
  releaseMs: number;
}

export function createDefaultExpander(): ExpanderParams {
  return {
    thresholdDb: -40,
    ratio: 2.0,
    attackMs: 5,
    releaseMs: 100,
  };
}


