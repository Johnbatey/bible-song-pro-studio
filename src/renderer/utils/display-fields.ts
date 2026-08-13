/* =========================================================================
   display-fields — the nested app state, flattened for the browser display
   -------------------------------------------------------------------------
   The audience display renderer (display.html) keeps a flat config and has no
   concept of our nested Theme or of Scene.background. Everything it is told is
   assembled here.

   This lives apart from App.tsx because it is the only description of what the
   browser output shows, it has no React in it, and a pure module is one that a
   check can call directly — see scripts/verify-display-fields.cjs. Importing it
   through App.tsx would drag in the store and the whole component tree.
   ========================================================================= */
import { resolveBgVideoLoop } from './background';
import type { Scene, Theme } from '../types';

/**
 * Font and reference fields.
 *
 * Two mismatches once meant the external output ignored both:
 *   - the theme was sent as `theme: {...}`, so every font/colour field was dropped
 *   - the output mode was sent as `outputMode`, but the page reads `mode`
 * so FS/LT switching and the whole Theme designer only ever affected the
 * Program pane.
 */
export function displayFieldsFor(theme: Theme | null, outputMode: 'fullscreen' | 'lowerThird') {
  const section = outputMode === 'lowerThird' ? theme?.lowerThird : theme?.fullScreen;
  const bible = theme?.bibleOptions;
  const fontColor = section?.fontColor || '#ffffff';

  return {
    // The display renderer calls this `mode`
    mode: outputMode,
    fontFamily: section?.fontFamily || 'Poppins',
    fontSize: section?.fontSize ?? 0,
    fontWeight: section?.fontWeight ?? 700,
    fontColor,
    textAlign: section?.textAlign || 'center',
    // These flat fields take precedence over the theme on the display side, so
    // they have to resolve the reference exactly the way ProgramSurface does for
    // the Program pane: sync follows the verse colour, otherwise the *active*
    // section's own reference colour wins. Reading lowerThird/fullScreen
    // unconditionally is what made the external output disagree with Program.
    referenceColor: section?.syncRefColor
      ? fontColor
      : (section?.referenceColor || theme?.lowerThird?.accentColor || '#e8541a'),
    referenceFontSize: section?.referenceFontSize ?? 0,
    // No theme control hides the reference today, so it always shows.
    showReference: true,
    showTranslation: bible?.showVersion ?? true,
  };
}

/**
 * Background fields (bgVideo / bgCustomImage / bgFill), so imported media,
 * gradients and theme grounds actually reach the output. Every field is sent on
 * each update — an explicit empty string is what clears a previous background.
 */
export function backgroundFieldsFor(scene: Scene | null, theme: Theme | null, outputMode: 'fullscreen' | 'lowerThird') {
  const bg = scene?.background;
  const themeFs = theme?.fullScreen;
  const fields = {
    bgVideo: '' as string,
    bgCustomImage: '' as string,
    bgFill: '' as string,
    bgFit: bg?.fit || (!bg ? themeFs?.backgroundFit : undefined) || 'cover',
    bgOpacity: typeof bg?.opacity === 'number' ? bg.opacity : 1,
    bgVideoLoop: resolveBgVideoLoop(bg, theme),
  };

  /* The theme's ground, for a scene that brings none of its own. Media outranks
     colour here exactly as it does in ProgramSurface — this page and that
     component are two renderings of one decision, and the moment they resolve
     it differently the browser output stops matching the projector.

     `background` is read before `backgroundColor`, which is what makes a theme
     *gradient* reach this page at all: a theme always carries a
     backgroundColor, so reading it first meant the browser display flattened
     every gradient the operator set to its start colour. */
  const applyThemeGround = () => {
    if (outputMode !== 'fullscreen') return;
    if (themeFs?.backgroundMediaType === 'video' && themeFs.backgroundMediaUrl) {
      fields.bgVideo = themeFs.backgroundMediaUrl;
    } else if (themeFs?.backgroundMediaType === 'image' && themeFs.backgroundMediaUrl) {
      fields.bgCustomImage = themeFs.backgroundMediaUrl;
    } else {
      fields.bgFill = themeFs?.background || themeFs?.backgroundColor || '#0c0e14';
    }
  };

  if (!bg) {
    applyThemeGround();
    return fields;
  }

  if (bg.type === 'video' && bg.mediaUrl) fields.bgVideo = bg.mediaUrl;
  else if (bg.type === 'image' && bg.mediaUrl) fields.bgCustomImage = bg.mediaUrl;
  else if (bg.type === 'gradient' && bg.gradient) fields.bgFill = bg.gradient;
  else if (bg.type === 'solid' && bg.color) fields.bgFill = bg.color;
  else if (bg.type === 'transparent') fields.bgFill = 'transparent';
  else applyThemeGround();

  return fields;
}
