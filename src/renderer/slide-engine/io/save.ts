/* =========================================================================
   Slide engine — persisting edits as OOXML
   -------------------------------------------------------------------------
   An edit writes into the slide's live XML document, so saving is just
   serializing that document. The result is stored on the deck record per
   slide, and put back into the in-memory package when the deck is reopened —
   before any slide is shown.

   This is the same document model the editor manipulates, not a
   reconstruction from a preview: reopening an edited deck re-parses the edited
   XML through the ordinary pipeline, so an edited slide renders through
   exactly the same code as an untouched one.

   Ported from the save/restore path of the reference editor's bridge/host.js.
   ========================================================================= */
import { ensureModifierSlideParsed } from '../parser/presentation';
import { state, type ParsedSlide } from '../state';

export interface SavedSlideXml {
  filename: string;
  xml: string;
}

/** True once a slide's text or geometry has been changed in this session. */
export function markSlideDirty(slide: ParsedSlide | null | undefined): void {
  if (slide) slide.pptxDirty = true;
}

export function isSlideDirty(slide: ParsedSlide | null | undefined): boolean {
  return !!slide?.pptxDirty;
}

export function serializeSlideXml(slide: ParsedSlide): string | null {
  if (!slide.xmlDoc) return null;
  return new XMLSerializer().serializeToString(slide.xmlDoc);
}

/**
 * The OOXML for every slide edited this session, keyed by slide index.
 *
 * Only dirty slides are collected. Serializing all of them would work but
 * would put the whole deck's XML into persisted app state for the sake of one
 * changed word — a 48-slide illustration deck is megabytes.
 */
export function collectEditedSlideXml(slides: ParsedSlide[]): Map<number, SavedSlideXml> {
  const out = new Map<number, SavedSlideXml>();
  slides.forEach((slide, index) => {
    if (!isSlideDirty(slide) || !slide.filename) return;
    const xml = serializeSlideXml(slide);
    if (xml && xml.trim()) {
      out.set(index, { filename: slide.filename as string, xml });
    }
  });
  return out;
}

/**
 * Put saved edits back into the in-memory package and force the affected
 * slides to re-parse from them.
 *
 * Returns the indices that were restored, so the caller can re-parse whichever
 * of them is on screen — the rest come back through the ordinary lazy path.
 */
export async function applySavedSlideXml(
  zip: any,
  slides: ParsedSlide[],
  saved: Array<SavedSlideXml | null | undefined>,
): Promise<number[]> {
  const restored: number[] = [];

  slides.forEach((slide, index) => {
    const entry = saved[index];
    if (!slide || !entry || typeof entry.xml !== 'string' || !entry.xml.trim()) return;

    /* Guard against a record that has drifted from its package — a deck
       re-imported with slides added or removed would otherwise write slide 3's
       saved XML over slide 5. */
    if (entry.filename && entry.filename !== slide.filename) return;

    zip.file(slide.filename as string, entry.xml);
    // Drop the parse so the edited XML goes through the ordinary pipeline.
    slide.xmlDoc = null;
    slide.shapes = [];
    slide.parsed = false;
    // A restored edit is already persisted; it only becomes dirty again if the
    // operator changes something.
    slide.pptxDirty = false;
    state.xmlDocCache.delete(slide.filename as string);
    restored.push(index);
  });

  return restored;
}

/** Re-parse one slide now, for the index the operator is looking at. */
export async function reparseSlide(index: number): Promise<void> {
  await ensureModifierSlideParsed(index);
}
