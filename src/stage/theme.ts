/* =========================================================================
   Stage display — operator theme
   -------------------------------------------------------------------------
   The colours and toggles the operator sets for the stage screen, plus the
   token resolver the zones paint through. Kept apart from the layout because
   the two are set independently: a layout says where things sit, a theme says
   what they look like, and either can change without the other.

   Ported from the theme half of the old stage-display.js.
   ========================================================================= */
import type { ColorToken } from './layouts';

export interface StageTheme {
  accent: string;
  background: string;
  text: string;
  fontScale: number;
  showClock: boolean;
  showTimer: boolean;
  showLabels: boolean;
}

const THEME_KEY = 'bsp-stage-theme';
const LAYOUT_KEY = 'bsp-stage-layout';

export function defaultTheme(): StageTheme {
  return {
    accent: '#fbbf24',
    background: '#000000',
    text: '#ffffff',
    fontScale: 1,
    showClock: true,
    showTimer: true,
    showLabels: true,
  };
}

/* localStorage throws outright for opaque origins — a file:// page in some
   sandboxes — so every access goes through a probe and falls back to a stub
   rather than taking the stage down over a persistence detail. */
interface MiniStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NO_STORAGE: MiniStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function safeStorage(): MiniStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__bsp_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* fall through */
  }
  return NO_STORAGE;
}

export function loadTheme(): StageTheme {
  try {
    const raw = safeStorage().getItem(THEME_KEY);
    if (raw) return { ...defaultTheme(), ...JSON.parse(raw) };
  } catch {
    /* corrupt or unavailable storage — the default is always usable */
  }
  return defaultTheme();
}

export function persistTheme(theme: StageTheme): void {
  try {
    safeStorage().setItem(THEME_KEY, JSON.stringify(theme));
  } catch {
    /* storage may be unavailable */
  }
}

export function loadLayoutId(): string | null {
  return safeStorage().getItem(LAYOUT_KEY);
}

export function persistLayoutId(id: string): void {
  try {
    safeStorage().setItem(LAYOUT_KEY, id);
  } catch {
    /* storage may be unavailable */
  }
}

/** Fade a #rrggbb toward transparent. Anything unparseable degrades to white
    at the same alpha rather than painting the zone black. */
export function applyAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(255,255,255,${alpha})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

/** Resolve a zone's colour: a semantic token against the theme, or a literal
    CSS colour passed straight through. */
export function resolveColor(token: ColorToken | undefined, theme: StageTheme): string {
  switch (token) {
    case 'accent':
      return theme.accent;
    case 'text':
      return theme.text;
    case 'muted':
      return applyAlpha(theme.text, 0.42);
    case 'faint':
      return applyAlpha(theme.text, 0.28);
    default:
      return token || theme.text;
  }
}
