/* =========================================================================
   Stage display — layout library
   -------------------------------------------------------------------------
   A layout is a list of zones placed on a 100x100 percentage grid, so one
   definition fits any stage screen without a breakpoint in sight. The four
   presets below are the ones the operator cycles with `L`; an operator-authored
   layout arrives at runtime as `customLayout` and uses the same zone vocabulary,
   which is why the shape is a plain data type rather than a component.

   Ported verbatim from the LAYOUTS table in the old public/stage-display/
   stage-display.js. The numbers are deliberately unchanged — a port that also
   redesigns is a port whose bugs cannot be told apart from its intent.
   ========================================================================= */

/** What a zone draws. Anything else falls back to a plain label. */
export type ZoneType =
  | 'playlist'
  | 'clock'
  | 'current-text'
  | 'next-item'
  | 'timer'
  | 'messages'
  /** Like current-text, but a live slide fills the whole cell instead of
      sharing it with the reference line and the notes. */
  | 'slide';

/** Semantic colour tokens resolve against the operator's theme; any other
    string is passed through as a literal CSS colour. */
export type ColorToken = 'accent' | 'text' | 'muted' | 'faint' | (string & {});

export interface StageZone {
  id: string;
  type: ZoneType | string;
  /** Percentages of the stage, not pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  fontWeight?: number;
  color?: ColorToken;
  bgColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  borderRadius?: number;
  padding?: number;
  fontFamily?: string;
  /** current-text only: the reference line's size as a percentage of the verse
      size, so 100 means "same size as the verse". */
  referenceFontScale?: number;
  label?: string;
  visible?: boolean;
}

export interface StageLayout {
  id: string;
  name: string;
  bgColor: string;
  zones: StageZone[];
}

export const LAYOUTS: Record<string, StageLayout> = {
  default: {
    id: 'default',
    name: 'Default',
    bgColor: '#000000',
    zones: [
      { id: 'z-playlist', type: 'playlist', x: 2, y: 1, w: 50, h: 6, fontSize: 16, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
      { id: 'z-clock', type: 'clock', x: 80, y: 1, w: 18, h: 6, fontSize: 20, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
      { id: 'z-current', type: 'current-text', x: 2, y: 8, w: 96, h: 60, fontSize: 48, fontWeight: 600, color: 'text', textAlign: 'center', visible: true },
      { id: 'z-next', type: 'next-item', x: 2, y: 72, w: 60, h: 8, fontSize: 18, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
      { id: 'z-timer', type: 'timer', x: 64, y: 72, w: 34, h: 8, fontSize: 28, fontWeight: 800, color: 'accent', textAlign: 'right', visible: true },
      { id: 'z-messages', type: 'messages', x: 60, y: 1, w: 38, h: 30, fontSize: 22, fontWeight: 700, color: '#ffffff', bgColor: 'rgba(239,68,68,0.9)', textAlign: 'left', borderRadius: 12, padding: 12, visible: true },
    ],
  },
  band: {
    id: 'band',
    name: 'Band / Lyrics',
    bgColor: '#0a0a0a',
    zones: [
      { id: 'z-playlist', type: 'playlist', x: 5, y: 1, w: 50, h: 6, fontSize: 16, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
      { id: 'z-clock', type: 'clock', x: 75, y: 78, w: 20, h: 8, fontSize: 18, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
      { id: 'z-current', type: 'current-text', x: 5, y: 5, w: 90, h: 70, fontSize: 56, fontWeight: 700, color: 'text', textAlign: 'center', visible: true },
      { id: 'z-next', type: 'next-item', x: 5, y: 78, w: 60, h: 8, fontSize: 16, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
    ],
  },
  sermon: {
    id: 'sermon',
    name: 'Sermon Notes',
    bgColor: '#05070d',
    zones: [
      { id: 'z-playlist', type: 'playlist', x: 3, y: 2, w: 60, h: 6, fontSize: 15, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
      { id: 'z-clock', type: 'clock', x: 82, y: 2, w: 15, h: 6, fontSize: 18, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
      { id: 'z-current', type: 'current-text', x: 3, y: 9, w: 94, h: 38, fontSize: 40, fontWeight: 600, color: 'text', textAlign: 'left', visible: true },
      { id: 'z-next', type: 'next-item', x: 3, y: 50, w: 94, h: 16, fontSize: 20, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
      { id: 'z-timer', type: 'timer', x: 3, y: 88, w: 40, h: 8, fontSize: 26, fontWeight: 800, color: 'accent', textAlign: 'left', visible: true },
    ],
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    bgColor: '#000000',
    zones: [
      { id: 'z-current', type: 'current-text', x: 6, y: 18, w: 88, h: 64, fontSize: 72, fontWeight: 800, color: 'text', textAlign: 'center', visible: true },
      { id: 'z-timer', type: 'timer', x: 70, y: 4, w: 26, h: 8, fontSize: 30, fontWeight: 800, color: 'accent', textAlign: 'right', visible: true },
    ],
  },
  /* One zone edge to edge, and deliberately nothing else. A presentation deck
     is a designed picture; a clock in its corner and a reference line above it
     are furniture drawn on top of someone else's artwork. This is the stage's
     answer to the Program view — the same slide, at the same size, on the
     musicians' monitor. The type sizes below only ever apply to the fallback
     text shown between slides. */
  slide: {
    id: 'slide',
    name: 'Slide',
    bgColor: '#000000',
    zones: [
      { id: 'z-slide', type: 'slide', x: 0, y: 0, w: 100, h: 100, fontSize: 56, fontWeight: 700, color: 'text', textAlign: 'center', visible: true },
    ],
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

/** The layout `L` moves to from the current one, wrapping in both directions. */
export function cycleLayoutId(currentId: string, direction = 1): string {
  const index = LAYOUT_IDS.indexOf(currentId);
  // An unknown id (a custom layout) cycles from the start rather than nowhere.
  const from = index === -1 ? -1 : index;
  return LAYOUT_IDS[(from + direction + LAYOUT_IDS.length) % LAYOUT_IDS.length];
}
