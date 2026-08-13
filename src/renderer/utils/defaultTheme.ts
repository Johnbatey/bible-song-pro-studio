import type { Theme } from '../types';

/**
 * The theme the console ships with — the look of BSP on a screen nobody has
 * configured yet, which makes it a brand surface rather than a preference.
 *
 * It used to be slate `#0f172a` with a `#C9A96E` gold accent in SF Pro. Three
 * problems with that, in order of seriousness:
 *
 *  1. The gold sits inside Johnson Olakotan's Signal Amber range, and BSP's
 *     Signal Orange is never allowed in the same composition as it. The accent
 *     on air is Signal, or it is not an accent.
 *  2. Slate is the blue-grey the neutral ramp exists to avoid, and it is the
 *     exact ground the four comparables all project on.
 *  3. Scripture is set in Source Serif 4 — the way scripture is actually set.
 *     Never bold: the Voice face carries weight through size and measure.
 *
 * Operators can still change all of it. This is the default, not a lock.
 */
export function createDefaultTheme(): Theme {
  return {
    id: 'settings-live-theme',
    name: 'Live Settings Theme',
    lowerThird: {
      // Flat booth, not a gradient. No effect exists to show that an effect exists.
      background: 'rgba(12, 11, 11, 0.94)',
      backgroundColor: '#0C0B0B',
      backgroundOpacity: 0.94,
      accentColor: '#FF5500',
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontSize: 36,
      fontWeight: 400,
      fontColor: '#FFFFFF',
      textAlign: 'left',
      padding: 20,
      borderRadius: 4,
      animation: 'slideInUp',
      position: 'bottom-center',
      width: 92,
      offsetX: 0,
      offsetY: 0,
      scale: 100,
      anchor: 'bottom',
    },
    fullScreen: {
      backgroundColor: '#0C0B0B',
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontSize: 56,
      fontWeight: 400,
      fontColor: '#FFFFFF',
      textAlign: 'center',
      animation: 'fade',
      referenceFontSize: 26,
      lineHeight: 1.25,
      verticalAlign: 'middle',
      autoResize: 'shrink',
    },
    slideTheme: {
      backgroundColor: '#0C0B0B',
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontSize: 40,
      fontWeight: 400,
      fontColor: '#FFFFFF',
      accentColor: '#FF5500',
      transition: 'fade',
    },
    bibleOptions: {
      showVersion: true,
      shortenVersions: false,
      shortenBooks: false,
      showVerseNumbers: false,
      versionSwitchUpdatesOutput: true,
    },
    songOptions: {
      textTransform: 'none',
      showCategoryName: true,
      displayBySections: true,
    },
  };
}

export function ensureTheme(theme: Theme | null | undefined): Theme {
  return theme || createDefaultTheme();
}
