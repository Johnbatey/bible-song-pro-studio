import type { SourceDocument } from './source';
import type { SceneTransitionConfig } from './transition';

export interface SceneItemReference {
  id: string; // Unique ID for this scene item placement
  sourceId: string; // Refers to the underlying SourceDocument
  visible: boolean;
  locked: boolean;
  order: number; // Stacking index (0 = bottom, higher = top)
  customTransform?: Partial<import('./source').SourceTransform>;
  customBlendMode?: import('./source').BlendMode;
  customOpacity?: number;
}

export interface BroadcastScene {
  id: string;
  name: string;
  description?: string;
  sceneItems: SceneItemReference[];
  transition?: SceneTransitionConfig | null; // Dedicated transition when switching TO this scene
  background?: {
    type: 'color' | 'gradient' | 'media';
    color?: string;
    gradient?: string;
    mediaUrl?: string;
  };
  meta: Record<string, any>;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SceneCollection {
  id: string;
  name: string;
  scenes: BroadcastScene[];
  sources: Record<string, SourceDocument>;
  activePreviewSceneId?: string | null;
  activeProgramSceneId?: string | null;
  quickTransitions?: import('./transition').QuickTransitionPreset[];
  exportedAt?: string;
  version: string;
}

export function createDefaultBroadcastScene(name = 'New Scene'): BroadcastScene {
  const timestamp = Date.now();
  return {
    id: `scene_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    sceneItems: [],
    transition: null,
    background: {
      type: 'color',
      color: '#000000',
    },
    meta: {},
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
