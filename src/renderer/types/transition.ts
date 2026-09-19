export type SceneTransitionType =
  | 'cut'
  | 'fade'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'push-left'
  | 'push-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'luma-wipe'
  | 'stinger'
  | 'anime-spring'
  | 'anime-elastic'
  | 'custom';

export type TransitionEasing =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'spring'
  | 'elastic';

export interface SceneTransitionConfig {
  type: SceneTransitionType;
  durationMs: number;
  easing: TransitionEasing;
  lumaPattern?: 'linear' | 'radial' | 'spiral' | 'blinds' | 'diamond' | 'zigzag';
  stingerPath?: string;
  stingerCutPointMs?: number;
  animeParams?: {
    tension?: number;
    friction?: number;
    mass?: number;
    velocity?: number;
  };
}

export interface TransitionRuntimeState {
  active: boolean;
  type: SceneTransitionType;
  fromSceneId: string | null;
  toSceneId: string | null;
  progress: number; // 0.0 to 1.0
  durationMs: number;
  startedAt: number;
  tBarValue: number; // 0.0 to 1.0 for manual T-Bar scrubbing
  isManualTBar: boolean;
}

export interface QuickTransitionPreset {
  id: string;
  label: string;
  type: SceneTransitionType;
  durationMs: number;
  hotkey?: string;
}

export const DEFAULT_QUICK_TRANSITIONS: QuickTransitionPreset[] = [
  { id: 'qt-cut', label: 'Cut', type: 'cut', durationMs: 0, hotkey: 'Space' },
  { id: 'qt-fade-300', label: 'Fade 300ms', type: 'fade', durationMs: 300 },
  { id: 'qt-fade-500', label: 'Fade 500ms', type: 'fade', durationMs: 500 },
  { id: 'qt-slide-left', label: 'Slide Left', type: 'slide-left', durationMs: 400 },
  { id: 'qt-slide-right', label: 'Slide Right', type: 'slide-right', durationMs: 400 },
  { id: 'qt-zoom', label: 'Zoom In', type: 'zoom-in', durationMs: 450 },
  { id: 'qt-wipe', label: 'Luma Wipe', type: 'luma-wipe', durationMs: 600 },
];
