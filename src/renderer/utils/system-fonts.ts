/**
 * System Fonts Utility
 * Discovers and lists all locally installed system fonts on the user's PC
 * (Mac / Windows / Linux) alongside bundled presentation fonts.
 */

export interface FontOptionItem {
  value: string;
  label: string;
  isSystemFont?: boolean;
}

export const BUNDLED_FONTS = [
  'Inter',
  'Poppins',
  'Montserrat',
  'Roboto',
  'Oswald',
  'Bebas Neue',
  'Playfair Display',
  'Crimson Pro',
  'Lora',
  'Cinzel',
];

const COMMON_PC_FONTS = [
  'Aptos',
  'Arial',
  'Arial Black',
  'Baskerville',
  'Big Caslon',
  'Bodoni 72',
  'Bradley Hand',
  'Brush Script MT',
  'Calibri',
  'Cambria',
  'Candara',
  'Century Gothic',
  'Chalkboard',
  'Chalkduster',
  'Comic Sans MS',
  'Consolas',
  'Copperplate',
  'Courier New',
  'Didot',
  'Futura',
  'Garamond',
  'Geneva',
  'Georgia',
  'Gill Sans',
  'Helvetica',
  'Helvetica Neue',
  'Impact',
  'Lucida Console',
  'Lucida Grande',
  'Monaco',
  'Optima',
  'Outfit',
  'Palatino',
  'Papyrus',
  'Rockwell',
  'Segoe UI',
  'SF Pro Display',
  'SF Pro Text',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Zapfino',
];

let cachedFonts: FontOptionItem[] | null = null;

/**
 * Applies the user-selected typing font to the document root as --font-typing.
 * When set, every text field, textarea, input, and typing surface in the app
 * uses this font.
 */
export function applyTypingFont(fontFamily?: string): void {
  if (typeof document === 'undefined') return;
  const font = fontFamily?.trim();
  if (font && font !== 'default' && font !== 'inherit') {
    document.documentElement.style.setProperty(
      '--font-typing',
      `"${font.replace(/"/g, '')}", var(--font-ui), system-ui, sans-serif`
    );
  } else {
    document.documentElement.style.setProperty('--font-typing', 'var(--font-ui)');
  }
}

export async function fetchInstalledSystemFonts(): Promise<FontOptionItem[]> {
  if (cachedFonts && cachedFonts.length > 0) {
    return cachedFonts;
  }

  const fontMap = new Map<string, boolean>();

  // Mark bundled fonts first
  BUNDLED_FONTS.forEach((f) => fontMap.set(f, false));

  // 1. Try Electron native IPC font scanner if available (queries OS font directories directly)
  if (typeof window !== 'undefined' && window.BSP?.fonts?.getSystemFonts) {
    try {
      const nativeFonts = await window.BSP.fonts.getSystemFonts();
      if (Array.isArray(nativeFonts)) {
        for (const fontName of nativeFonts) {
          if (fontName && !fontMap.has(fontName)) {
            fontMap.set(fontName, true);
          }
        }
      }
    } catch (e) {
      console.warn('[SystemFonts] Native font scan fallback:', e);
    }
  }

  // 2. Try Window Font Access API (queryLocalFonts) supported natively in Electron/Chromium
  if (typeof window !== 'undefined' && 'queryLocalFonts' in window && typeof (window as any).queryLocalFonts === 'function') {
    try {
      const localFonts = await (window as any).queryLocalFonts();
      if (Array.isArray(localFonts)) {
        for (const f of localFonts) {
          if (f.family && !fontMap.has(f.family)) {
            fontMap.set(f.family, true);
          }
        }
      }
    } catch (e) {
      console.warn('[SystemFonts] Local font access query fallback:', e);
    }
  }

  // 3. Check common system fonts with document.fonts.check
  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function') {
    for (const font of COMMON_PC_FONTS) {
      if (!fontMap.has(font)) {
        try {
          if (document.fonts.check(`12px "${font}"`)) {
            fontMap.set(font, true);
          }
        } catch {
          // ignore
        }
      }
    }
  } else {
    COMMON_PC_FONTS.forEach((f) => {
      if (!fontMap.has(f)) fontMap.set(f, true);
    });
  }

  const result: FontOptionItem[] = [];
  fontMap.forEach((isSystemFont, name) => {
    result.push({
      value: name,
      label: name,
      isSystemFont,
    });
  });

  // Sort: bundled fonts top, system fonts sorted alphabetically
  result.sort((a, b) => {
    const aBundled = BUNDLED_FONTS.includes(a.value);
    const bBundled = BUNDLED_FONTS.includes(b.value);
    if (aBundled && !bBundled) return -1;
    if (!aBundled && bBundled) return 1;
    return a.value.localeCompare(b.value);
  });

  cachedFonts = result;
  return result;
}
