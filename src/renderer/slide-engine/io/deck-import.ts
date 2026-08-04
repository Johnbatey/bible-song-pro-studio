/* =========================================================================
   Slide engine — headless deck import
   -------------------------------------------------------------------------
   Parses a .pptx into the slide structure the presentation library wants,
   using this project's own OOXML parser — no LibreOffice, no PDF, no
   rasterization.

   It reuses parser/slide-parser.ts, so import inherits every fidelity round
   the parser has: placeholder inheritance, theme colour resolution, preset and
   custom geometry, tables, connectors, transforms. In place of a regex over
   <a:t> that flattens every text box, decorative art label and table cell into
   one blob in document order, this knows which box is the title and reads the
   rest top-to-bottom, left-to-right.

   It produces STRUCTURE, not pixels. Slide images, transitions, timings, build
   steps and speaker notes stay with whatever else produces them;
   mergeIntoDeckSlides joins the two by slide order.

   Ported from the reference editor's io/deck-import.js.
   ========================================================================= */
import JSZip from 'jszip';
import { updatePptxSlideSizeFromZip, getSlideKeysInPresentationOrder } from '../core/zip-io';
import { updatePptxThemeFromZip } from '../parser/theme';
import { parseModifierSlide } from '../parser/presentation';
import { state, type ParsedSlide, type SlideSizeEmu } from '../state';
import { withEngineLock } from '../engine-lock';
import type { ParsedShape } from '../parser/slide-parser';

export interface DeckSlideRecord {
  id: string;
  title: string;
  body: string;
  label: string;
  thumbText: string;
  order: number;
  textBoxCount: number;
  shapeCount: number;
}

export interface DeckStructure {
  deckId: string;
  title: string;
  aspectRatio: string;
  slideCount: number;
  slides: DeckSlideRecord[];
}

export interface ImportDeckOptions {
  deckId?: string;
  fileName?: string;
  onProgress?: (progress: { done: number; total: number }) => void;
}

/* Deck-wide parse context lives on the shared state singleton (theme maps,
   slide size, rel/XML caches). Import must not disturb a deck the operator
   already has open, so the whole slice is swapped out and restored.

   NOTE: this is the reference's list verbatim, and it omits pptxThemeCache and
   pptxThemeFmtScheme — theme.ts creates the cache lazily and keys it by zip
   path ("ppt/theme/theme1.xml"), a path both decks share. So importing one deck
   while another is open can leave the open deck resolving colours against the
   imported deck's theme. Copied as-is rather than silently fixed; adding both
   keys here is the whole fix. */
const SCOPED_STATE_KEYS = [
  'loadedPptxZip',
  'pptxSlideSizeEmu',
  'pptxThemeColorMap',
  'pptxThemeAliasMap',
  'pptxThemeFonts',
  'slideRelsCache',
  'slideRelsDetailCache',
  'xmlDocCache',
] as const;

type ScopedKey = typeof SCOPED_STATE_KEYS[number];

function captureState(): Partial<Record<ScopedKey, unknown>> {
  const saved: Partial<Record<ScopedKey, unknown>> = {};
  SCOPED_STATE_KEYS.forEach((key) => { saved[key] = state[key]; });
  return saved;
}

function restoreState(saved: Partial<Record<ScopedKey, unknown>>): void {
  SCOPED_STATE_KEYS.forEach((key) => { (state as any)[key] = saved[key]; });
}

function beginScopedParse(): void {
  state.loadedPptxZip = null;
  state.pptxSlideSizeEmu = { cx: 12192000, cy: 6858000 };
  state.pptxThemeColorMap = new Map();
  state.pptxThemeAliasMap = new Map();
  state.pptxThemeFonts = { major: null, minor: null };
  state.slideRelsCache = new Map();
  state.slideRelsDetailCache = new Map();
  state.xmlDocCache = new Map();
}

/** Placeholder types that carry a slide's heading, in PowerPoint's own terms. */
const TITLE_PLACEHOLDERS = ['title', 'ctrTitle'];

function isTitlePlaceholder(shape: ParsedShape): boolean {
  const type = (shape as any)?.placeholder?.type;
  return TITLE_PLACEHOLDERS.includes(String(type || ''));
}

/** Flattens a paragraph list ([[run,…],…]) to text, dropping blank markers. */
export function paragraphsToText(paragraphs: unknown): string {
  return (Array.isArray(paragraphs) ? paragraphs : [])
    .map((runs) => (Array.isArray(runs) ? runs.map((r) => String((r && r.text) || '')).join('') : ''))
    .join('\n')
    .replace(/\u200B/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Table cell text, row by row, cells joined by tabs — reads as a table. */
export function tableToText(shape: ParsedShape): string {
  const rows = (shape && Array.isArray((shape as any).rows)) ? (shape as any).rows : [];
  return rows
    .map((row: any) => ((row && Array.isArray(row.cells)) ? row.cells : [])
      .map((cell: any) => paragraphsToText(cell && cell.paragraphs).replace(/\n/g, ' '))
      .join('\t')
      .trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * The text a viewer actually sees on this shape, or "" if it carries none.
 *
 * Covers all three carriers the parser produces: text boxes, tables
 * (kind:"table" — text lives in rows[].cells[].paragraphs, never on the
 * record's own empty `paragraphs`) and charts (kind:"text", but with
 * nodeRef-less synthetic runs). Skipping tables or charts would lose content a
 * regex extractor DID catch — a regression, not a refinement.
 *
 * The filter that matters is *visible characters*, not editability.
 * Decorative custGeom illustration art carries a throwaway txBody whose runs
 * are empty or zero-width; that is what would otherwise flood the body with
 * noise (the trap behind the "223 text fields" bug).
 */
export function visibleTextOf(shape: ParsedShape | null): string {
  if (!shape) return '';
  if (shape.kind === 'table') return tableToText(shape);
  if (shape.kind !== 'text') return '';
  return paragraphsToText(shape.paragraphs);
}

export function hasVisibleText(shape: ParsedShape | null): boolean {
  return visibleTextOf(shape).length > 0;
}

/**
 * Title + body for one parsed slide.
 *
 * Order of preference for the title:
 *   1. the title/ctrTitle placeholder — PowerPoint's own answer
 *   2. failing that, the topmost visible TEXT BOX on the slide
 * A table is never a title even when it is the topmost thing on the slide:
 * a deck of data slides would otherwise get tab-separated grid dumps as
 * its deck-grid captions. Tables can only ever be body.
 *
 * Body is every other visible text carrier in reading order (top to bottom,
 * then left to right), which is what an operator sees — not XML order.
 */
export function deriveSlideText(slide: ParsedSlide | null, index: number): { title: string; body: string; textBoxCount: number } {
  const shapes = ((slide && Array.isArray(slide.shapes) ? slide.shapes : []) as ParsedShape[])
    .filter((shape) => (shape as any).editable !== false && hasVisibleText(shape));

  const readingOrder = shapes.slice().sort((a, b) => {
    const dy = (Number(a.top) || 0) - (Number(b.top) || 0);
    // Same band (within ~2% of slide height) reads left to right.
    const band = (Number(state.pptxSlideSizeEmu.cy) || 6858000) * 0.02;
    if (Math.abs(dy) > band) return dy;
    return (Number(a.left) || 0) - (Number(b.left) || 0);
  });

  const titleShape =
    readingOrder.find(isTitlePlaceholder) ||
    readingOrder.find((shape) => shape.kind === 'text') ||
    null;
  const title = titleShape ? visibleTextOf(titleShape) : '';
  const body = readingOrder
    .filter((shape) => shape !== titleShape)
    .map(visibleTextOf)
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    title: title || `Slide ${index + 1}`,
    body,
    textBoxCount: readingOrder.length,
  };
}

export function aspectRatioFromEmu(size: SlideSizeEmu | null): string {
  const cx = Number(size && size.cx) || 12192000;
  const cy = Number(size && size.cy) || 6858000;
  const ratio = cx / cy;
  if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(ratio - 16 / 10) < 0.02) return '16:10';
  return '16:9';
}

/** Parse a .pptx into deck-shaped slide structure. */
export function importDeckStructure(
  bytes: ArrayBuffer | Uint8Array,
  options?: ImportDeckOptions,
): Promise<{ ok: boolean; error?: string; deck?: DeckStructure }> {
  return withEngineLock(() => importDeckStructureLocked(bytes, options));
}

async function importDeckStructureLocked(
  bytes: ArrayBuffer | Uint8Array,
  options?: ImportDeckOptions,
): Promise<{ ok: boolean; error?: string; deck?: DeckStructure }> {
  const opts = options || {};
  const fileName = String(opts.fileName || 'presentation.pptx');
  const deckId = String(opts.deckId || fileName.replace(/\.pptx$/i, '')).trim() || 'deck';

  const saved = captureState();
  try {
    beginScopedParse();

    const zipObj = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
    state.loadedPptxZip = zipObj;

    await updatePptxSlideSizeFromZip(zipObj);
    await updatePptxThemeFromZip(zipObj);

    const slideKeys = await getSlideKeysInPresentationOrder(zipObj);
    if (!slideKeys.length) return { ok: false, error: 'pptx-no-slides-found' };

    const slides: DeckSlideRecord[] = [];
    for (let index = 0; index < slideKeys.length; index++) {
      const parsed = await parseModifierSlide(zipObj, slideKeys[index], index + 1);
      const text = deriveSlideText(parsed, index);
      slides.push({
        id: `${deckId}-slide-${index + 1}`,
        title: text.title,
        body: text.body,
        label: `Slide ${index + 1}`,
        thumbText: String(index + 1).padStart(2, '0'),
        order: index,
        textBoxCount: text.textBoxCount,
        shapeCount: Array.isArray(parsed.shapes) ? parsed.shapes.length : 0,
      });
      if (typeof opts.onProgress === 'function') {
        opts.onProgress({ done: index + 1, total: slideKeys.length });
      }
    }

    return {
      ok: true,
      deck: {
        deckId,
        title: fileName.replace(/\.pptx$/i, '') || 'Imported Presentation',
        aspectRatio: aspectRatioFromEmu(state.pptxSlideSizeEmu),
        slideCount: slides.length,
        slides,
      },
    };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  } finally {
    restoreState(saved);
  }
}

/**
 * Join this structure onto slide records produced elsewhere by order, so those
 * keep everything they already extract well (transition, timing, build steps,
 * notes, preview image) and gain a real title/body pair.
 *
 * Order is a safe join key: slide order comes from the same presentation.xml
 * relationships getSlideKeysInPresentationOrder reads. Extra slides on either
 * side pass through untouched.
 */
export function mergeIntoDeckSlides<T extends { title?: string; body?: string }>(hostSlides: T[], deck: DeckStructure | null): T[] {
  const ours = deck && Array.isArray(deck.slides) ? deck.slides : [];
  return (Array.isArray(hostSlides) ? hostSlides : []).map((slide, index) => {
    const mine = ours[index];
    if (!mine) return slide;
    return Object.assign({}, slide, {
      title: mine.title || slide.title,
      body: mine.body || slide.body,
    });
  });
}
