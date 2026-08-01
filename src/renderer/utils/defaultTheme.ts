import type { Theme } from '../types';

export function createDefaultTheme(): Theme {
  return {
    id: 'settings-live-theme',
    name: 'Live Settings Theme',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(10,18,32,0.94), rgba(37,52,78,0.94))',
      backgroundColor: '#0f172a',
      backgroundOpacity: 0.94,
      accentColor: '#C9A96E',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 20,
      borderRadius: 18,
      animation: 'slideInUp',
      position: 'bottom-center',
      width: 92,
      offsetX: 0,
      offsetY: 0,
      scale: 100,
      anchor: 'bottom',
    },
    fullScreen: {
      backgroundColor: '#0f172a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 56,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'fade',
      referenceFontSize: 26,
      lineHeight: 1.25,
      verticalAlign: 'middle',
      autoResize: 'shrink',
    },
    slideTheme: {
      backgroundColor: '#0f172a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 40,
      fontWeight: 600,
      fontColor: '#ffffff',
      accentColor: '#C9A96E',
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
