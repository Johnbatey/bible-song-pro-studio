import type { Scene, DisplayState } from '../types';

/**
 * Resolves the effective output mode (FS vs LT) based on content category:
 * - Bible scenes follow `bibleOutputMode`
 * - Song scenes follow `songOutputMode`
 * - Media and Pro Slides (Presentations) always render in 'fullscreen'
 * - Other scene types or defaults follow the general `outputMode`
 */
export function resolveEffectiveOutputMode(
  scene: Scene | null | undefined,
  display: Pick<DisplayState, 'outputMode' | 'bibleOutputMode' | 'songOutputMode'>
): 'fullscreen' | 'lowerThird' {
  if (scene?.type === 'bible') {
    return display.bibleOutputMode || 'fullscreen';
  }
  if (scene?.type === 'song') {
    return display.songOutputMode || 'fullscreen';
  }
  if (scene?.type === 'presentation' || scene?.type === 'media') {
    return 'fullscreen';
  }
  return display.outputMode || 'fullscreen';
}
