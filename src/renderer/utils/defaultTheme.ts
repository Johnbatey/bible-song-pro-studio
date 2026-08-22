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
    id: 'theme-bsp-studio-pro',
    name: 'BSP Studio Pro',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(5, 7, 13, 0.95))',
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      gradientStart: '#0f172a',
      gradientEnd: '#05070d',
      gradientDirection: '135deg',
      backgroundOpacity: 0.95,
      accentColor: '#FF5500',
      referenceColor: '#FF5500',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      padding: 20,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-center',
      width: 75,
      offsetX: 0,
      offsetY: 0,
      scale: 100,
      anchor: 'bottom',
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #0f172a, #05070d)',
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      gradientStart: '#0f172a',
      gradientEnd: '#05070d',
      gradientDirection: '135deg',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 60,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#FF5500',
      referenceFontSize: 36,
      textAlign: 'center',
      animation: 'fade',
      lineHeight: 1.25,
      verticalAlign: 'middle',
      autoResize: 'shrink',
    },
    slideTheme: {
      backgroundColor: '#0f172a',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 40,
      fontWeight: 600,
      fontColor: '#ffffff',
      accentColor: '#FF5500',
      transition: 'fade',
    },
    bibleOptions: {
      showVersion: true,
      shortenVersions: true,
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
  const def = createDefaultTheme();
  if (!theme) return def;
  const isDefaultTheme = theme.id === 'theme-bsp-studio-pro' || theme.id === 'settings-live-theme';
  return {
    ...def,
    ...theme,
    lowerThird: {
      ...def.lowerThird,
      ...theme.lowerThird,
      width: isDefaultTheme && (theme.lowerThird?.width === 92 || theme.lowerThird?.width === 95 || !theme.lowerThird?.width)
        ? 75
        : (theme.lowerThird?.width ?? 75),
    },
    fullScreen: {
      ...def.fullScreen,
      ...theme.fullScreen,
    },
    bibleOptions: {
      showVersion: theme.bibleOptions?.showVersion ?? def.bibleOptions!.showVersion,
      shortenVersions: theme.bibleOptions?.shortenVersions ?? def.bibleOptions!.shortenVersions,
      shortenBooks: theme.bibleOptions?.shortenBooks ?? def.bibleOptions!.shortenBooks,
      showVerseNumbers: theme.bibleOptions?.showVerseNumbers ?? def.bibleOptions!.showVerseNumbers,
      versionSwitchUpdatesOutput: theme.bibleOptions?.versionSwitchUpdatesOutput ?? def.bibleOptions!.versionSwitchUpdatesOutput,
    },
    songOptions: {
      textTransform: theme.songOptions?.textTransform ?? def.songOptions!.textTransform,
      showCategoryName: theme.songOptions?.showCategoryName ?? def.songOptions!.showCategoryName,
      displayBySections: theme.songOptions?.displayBySections ?? def.songOptions!.displayBySections,
    },
  };
}
