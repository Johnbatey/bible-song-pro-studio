import type { FxDocument } from './fx';

export type SourceType =
  | 'slide'
  | 'media'
  | 'camera'
  | 'ndi'
  | 'browser'
  | 'color'
  | 'image'
  | 'audio_input'
  | 'window_capture'
  | 'nested_scene'
  | 'custom';

export type BlendMode =
  | 'normal'
  | 'additive'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface SourceTransform {
  x: number; // Position X in pixels or relative percentage
  y: number; // Position Y in pixels or relative percentage
  width: number; // Render width
  height: number; // Render height
  rotation: number; // Rotation in degrees (0 - 360)
  scaleX: number; // Horizontal scale factor (1 = 100%)
  scaleY: number; // Vertical scale factor (1 = 100%)
  crop: SourceCrop;
  alignment: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'stretch' | 'fit';
  aspectRatioLocked: boolean;
}

export interface SourceCrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SourceAudioConfig {
  volumeDb: number; // -Infinity to +6 dB (0 dB unity)
  muted: boolean;
  solo: boolean;
  pan: number; // -100 (Left) to +100 (Right), 0 center
  syncOffsetMs: number; // Audio delay in ms (-500 to +500)
  monitoringEnabled: boolean; // 2-option monitoring: Monitor off (false) vs Monitor enabled (true)
  monitoringType?: 'none' | 'monitor_only' | 'monitor_and_output'; // Legacy compatibility
  trackRouting: number[]; // e.g. [1, 2] for multi-track stem routing
  fxChainId?: string;
}

export interface SourceDocument {
  id: string;
  type: SourceType;
  name: string;
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  opacity: number; // 0.0 to 1.0
  transform: SourceTransform;
  audio?: SourceAudioConfig;
  config: Record<string, any>;
  videoFxChain: FxDocument[]; // List of Video FX
  audioFxChain: FxDocument[]; // List of Audio FX
  meta: Record<string, any>;
}

export function createDefaultSourceTransform(): SourceTransform {
  return {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    crop: { top: 0, bottom: 0, left: 0, right: 0 },
    alignment: 'fit',
    aspectRatioLocked: true,
  };
}

export function createDefaultSourceAudio(): SourceAudioConfig {
  return {
    volumeDb: 0,
    muted: false,
    solo: false,
    pan: 0,
    syncOffsetMs: 0,
    monitoringEnabled: false,
    monitoringType: 'none',
    trackRouting: [1],
  };
}
