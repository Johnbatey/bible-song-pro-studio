/* =========================================================================
   Slide engine — shared mutable state
   -------------------------------------------------------------------------
   The reference keeps these in app/state.js as a single mutable singleton, and
   every parser module reads and writes it directly. That is kept deliberately.

   This does NOT belong in the zustand store: it holds live DOM nodes
   (`xmlDoc`), a JSZip instance, and Maps keyed by zip path. None of it is
   serialisable, none of it should be reactive, and re-rendering on every cache
   write during a parse would be ruinous. The store holds the deck record; this
   holds the machinery that produced it.
   ========================================================================= */

export interface ThemeData {
  colorMap: Map<string, string>;
  fonts: { major: string | null; minor: string | null };
  fillStyles: Element[];
  bgFillStyles: Element[];
}

export interface SlideSizeEmu {
  cx: number;
  cy: number;
}

export interface ParsedSlide {
  id: number | string;
  kind: 'pptx' | 'native';
  filename?: string;
  backgroundColor?: string | null;
  shapes?: unknown[];
  xmlDoc?: Document | null;
  parsed?: boolean;
  previewDataUrl?: string | null;
  [key: string]: unknown;
}

export interface SlideEngineState {
  /** The open .pptx package. Null until a deck is imported. */
  loadedPptxZip: unknown | null;
  originalPptxFileName: string;

  /** Default is a 16:9 deck at 13.333in x 7.5in. */
  pptxSlideSizeEmu: SlideSizeEmu;
  /** lvl1..lvl9 pPr nodes from presentation.xml, indexed by level. */
  presentationDefaultTextStyleNodes: (Element | null)[] | null;

  pptxThemeColorMap: Map<string, string>;
  pptxThemeAliasMap: Map<string, string>;
  pptxThemeFonts: { major: string | null; minor: string | null };
  pptxThemeFmtScheme: { fillStyles: Element[]; bgFillStyles: Element[] };
  /** Per-theme-path, so a multi-master deck resolves each slide against its own. */
  pptxThemeCache: Map<string, ThemeData | null>;

  slideRelsCache: Map<string, Map<string, string>>;
  slideRelsDetailCache: Map<string, Array<{ id: string; type: string; target: string }>>;
  xmlDocCache: Map<string, Document>;

  slides: ParsedSlide[];
  activeSlideIndex: number;

  pptxImportJob: { id: number; cancelled: boolean; timeoutId: number | undefined } | null;
}

function freshAliasMap(): Map<string, string> {
  return new Map([
    ['bg1', 'bg1'], ['tx1', 'tx1'], ['bg2', 'bg2'], ['tx2', 'tx2'],
    ['accent1', 'accent1'], ['accent2', 'accent2'], ['accent3', 'accent3'],
    ['accent4', 'accent4'], ['accent5', 'accent5'], ['accent6', 'accent6'],
    ['hlink', 'hlink'], ['folHlink', 'folHlink'],
  ]);
}

export const state: SlideEngineState = {
  loadedPptxZip: null,
  originalPptxFileName: 'presentation.pptx',

  pptxSlideSizeEmu: { cx: 12192000, cy: 6858000 },
  presentationDefaultTextStyleNodes: null,

  pptxThemeColorMap: new Map(),
  pptxThemeAliasMap: freshAliasMap(),
  pptxThemeFonts: { major: null, minor: null },
  pptxThemeFmtScheme: { fillStyles: [], bgFillStyles: [] },
  pptxThemeCache: new Map(),

  slideRelsCache: new Map(),
  slideRelsDetailCache: new Map(),
  xmlDocCache: new Map(),

  slides: [],
  activeSlideIndex: 0,

  pptxImportJob: null,
};

/** Clears every per-deck cache. Called before opening a new package. */
export function resetDeckCaches(): void {
  state.slideRelsCache.clear();
  state.slideRelsDetailCache.clear();
  state.xmlDocCache.clear();
  state.pptxThemeCache = new Map();
  state.pptxThemeAliasMap = freshAliasMap();
}

export { freshAliasMap };
