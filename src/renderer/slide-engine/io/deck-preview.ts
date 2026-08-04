/* =========================================================================
   Slide engine — first-slide previews for the deck grid
   -------------------------------------------------------------------------
   The Slides page shows a card per deck. Painting that card from the real
   slide rather than a stand-in means parsing one slide out of the package —
   the same parse the editor does, so the card and the editor can never
   disagree about what a deck looks like.

   Nothing is rasterized. The card renders <SlideCanvas> at card width, so a
   preview is the slide itself scaled down, not a picture of it taken at import
   time that goes stale the moment anything is edited.

   Only slide 1 is parsed, and the package is dropped as soon as it is.
   ========================================================================= */
import JSZip from 'jszip';
import { updatePptxSlideSizeFromZip, getSlideKeysInPresentationOrder } from '../core/zip-io';
import { updatePptxThemeFromZip } from '../parser/theme';
import { parseModifierSlide } from '../parser/presentation';
import { state, type ParsedSlide, type SlideSizeEmu } from '../state';

export interface DeckPreview {
  slide: ParsedSlide;
  slideSizeEmu: SlideSizeEmu;
}

/* The deck-wide parse context is a singleton, so previewing a deck while the
   operator has another one open would corrupt the open one. Everything the
   parse touches is swapped out and restored.

   This list is deliberately longer than the one in deck-import.ts: it also
   covers pptxThemeCache and pptxThemeFmtScheme. That module keeps the
   reference's original list verbatim, which omits them — see the note there.
   A preview runs while a deck is open on screen, so the leak that omission
   allows would be visible immediately, as an open deck repainting in another
   deck's colours. */
const SCOPED_KEYS = [
  'loadedPptxZip',
  'pptxSlideSizeEmu',
  'pptxThemeColorMap',
  'pptxThemeAliasMap',
  'pptxThemeFonts',
  'pptxThemeFmtScheme',
  'pptxThemeCache',
  'presentationDefaultTextStyleNodes',
  'slideRelsCache',
  'slideRelsDetailCache',
  'xmlDocCache',
  'slides',
  'activeSlideIndex',
] as const;

type ScopedKey = typeof SCOPED_KEYS[number];

function capture(): Partial<Record<ScopedKey, unknown>> {
  const saved: Partial<Record<ScopedKey, unknown>> = {};
  SCOPED_KEYS.forEach((k) => { saved[k] = state[k]; });
  return saved;
}

function restore(saved: Partial<Record<ScopedKey, unknown>>): void {
  SCOPED_KEYS.forEach((k) => { (state as any)[k] = saved[k]; });
}

function beginScopedParse(): void {
  state.loadedPptxZip = null;
  state.pptxSlideSizeEmu = { cx: 12192000, cy: 6858000 };
  state.pptxThemeColorMap = new Map();
  state.pptxThemeAliasMap = new Map();
  state.pptxThemeFonts = { major: null, minor: null };
  state.pptxThemeFmtScheme = { fillStyles: [], bgFillStyles: [] };
  state.pptxThemeCache = new Map();
  state.presentationDefaultTextStyleNodes = null;
  state.slideRelsCache = new Map();
  state.slideRelsDetailCache = new Map();
  state.xmlDocCache = new Map();
  state.slides = [];
  state.activeSlideIndex = 0;
}

/**
 * Parse one slide out of a package for display.
 *
 * @param savedXml  the deck record's stored edit for that slide, if any, so a
 *                  card shows the edited version rather than the imported one
 */
export async function parseDeckPreview(
  bytes: ArrayBuffer,
  slideIndex = 0,
  savedXml?: string | null,
): Promise<DeckPreview | null> {
  const saved = capture();
  try {
    beginScopedParse();

    const zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
    state.loadedPptxZip = zip;
    await updatePptxSlideSizeFromZip(zip);
    await updatePptxThemeFromZip(zip);

    const keys = await getSlideKeysInPresentationOrder(zip);
    const key = keys[slideIndex];
    if (!key) return null;

    if (savedXml && savedXml.trim()) zip.file(key, savedXml);

    const slide = await parseModifierSlide(zip, key, slideIndex + 1);
    return { slide, slideSizeEmu: { ...state.pptxSlideSizeEmu } };
  } catch (err) {
    console.warn('Deck preview failed', err);
    return null;
  } finally {
    restore(saved);
  }
}
