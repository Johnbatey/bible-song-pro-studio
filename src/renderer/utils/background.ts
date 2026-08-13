/* =========================================================================
   Background helpers — one reading of a background string, one way to build one
   -------------------------------------------------------------------------
   A theme stores its ground as flat CSS strings (`background`,
   `backgroundColor`, plus the gradient parts it was assembled from); a scene
   stores a structured `Background`. Both editors have to turn a colour picker
   into CSS and read CSS back into pickers, and doing that twice is how the two
   drift into disagreeing about what "radial" means.
   ========================================================================= */
import type { Background, Theme } from '../types';

export interface BackgroundInfo {
  type: 'solid' | 'gradient' | 'transparent';
  color: string;
  start: string;
  end: string;
  dir: string;
}

export const DEFAULT_GROUND = '#0c0e14';
export const DEFAULT_GRADIENT_START = '#0f172a';
export const DEFAULT_GRADIENT_END = '#312e81';

/** Assemble the CSS for a gradient. `radial` is a direction here, not a type. */
export function gradientCss(start: string, end: string, dir: string): string {
  return dir === 'radial'
    ? `radial-gradient(circle, ${start}, ${end})`
    : `linear-gradient(${dir}, ${start}, ${end})`;
}

/**
 * Read a stored background string back into the parts an editor shows. Colours
 * are recovered by matching, because the string is the only record of them once
 * a theme has been round-tripped through a save.
 */
export function parseBackgroundInfo(
  bgStr: string | undefined,
  colorStr: string | undefined,
): BackgroundInfo {
  const str = bgStr || colorStr || DEFAULT_GROUND;
  if (str === 'transparent') {
    return {
      type: 'transparent',
      color: '#000000',
      start: DEFAULT_GRADIENT_START,
      end: DEFAULT_GRADIENT_END,
      dir: '135deg',
    };
  }
  if (str.includes('gradient')) {
    const hexes = str.match(/#[0-9a-fA-F]{3,8}/g) || [];
    const rgbes = str.match(/rgba?\([^)]+\)/g) || [];
    const colors = [...hexes, ...rgbes];
    const dirMatch = str.match(/(\d+deg|circle)/i);
    return {
      type: 'gradient',
      color: colors[0] || DEFAULT_GRADIENT_START,
      start: colors[0] || DEFAULT_GRADIENT_START,
      end: colors[colors.length - 1] || DEFAULT_GRADIENT_END,
      /* `circle` is how a radial gradient reads in CSS; the editor calls that
         direction `radial`, so translate rather than offering a direction the
         dropdown has no option for. */
      dir: dirMatch ? (dirMatch[1].toLowerCase() === 'circle' ? 'radial' : dirMatch[1]) : '135deg',
    };
  }
  return {
    type: 'solid',
    color: str.startsWith('#') || str.startsWith('rgb') ? str : DEFAULT_GROUND,
    start: DEFAULT_GRADIENT_START,
    end: DEFAULT_GRADIENT_END,
    dir: '135deg',
  };
}

/**
 * A one-line description of a background, for a picker's summary row. Media is
 * named by its file rather than its URL — `/media/a1b2c3.mp4` tells an operator
 * nothing about which clip they picked.
 */
export function describeBackground(bg: Background | undefined, mediaName?: string): string {
  if (!bg) return 'Theme background';
  switch (bg.type) {
    case 'image': return mediaName || 'Image';
    case 'video': return mediaName || 'Video';
    case 'gradient': return 'Gradient';
    case 'solid': return bg.color || 'Solid colour';
    case 'transparent': return 'Transparent';
    default: return 'Theme background';
  }
}

/**
 * Whether the background clip should loop. Whoever supplies the video supplies
 * the answer: a scene's own clip carries its own flag, and only a scene with no
 * background at all defers to the theme's. Derived in one place because the
 * Program pane, the Preview pane and the audience window each need it, and a
 * surface that disagreed would loop a clip the others had let run out.
 */
export function resolveBgVideoLoop(
  background: Background | undefined,
  theme: Theme | null | undefined,
): boolean {
  if (background) return background.loop !== false;
  return theme?.fullScreen?.backgroundLoop !== false;
}

/** The CSS to paint a background into a small swatch or preview tile. */
export function backgroundSwatchCss(bg: Background | undefined): string {
  if (!bg) return DEFAULT_GROUND;
  if (bg.type === 'gradient' && bg.gradient) return bg.gradient;
  if (bg.type === 'solid' && bg.color) return bg.color;
  if (bg.type === 'transparent') return 'transparent';
  return '#000';
}
